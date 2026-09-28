/* -----------------------------------------------------------------
   requests.ts: the real, Firestore-backed pipeline behind /action.

     donors/{uid}                 public donor card (no phone)
     donors_private/{uid}         phone, released only after approval
     requests/{requesterUid}_{donorUid}
                                  one person asking one donor for blood
     threads/{requestId}          chat between the two, created on approval
     threads/{id}/messages/{mid}  the messages
     notifications/{id}           per-user notifications

   Everything a screen shows is subscribed with onSnapshot, so a request
   made from one account appears on the other account live.
-------------------------------------------------------------------- */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/backend/lib/firebase";
import { getUserProfile } from "@/backend/lib/userProfile";
import {
  encodeGeohash,
  encodeWideGeohash,
  haversineDistanceKm,
  wideGeohashSearchCells,
} from "@/backend/lib/geohash";
import type {
  AppNotification,
  BloodType,
  ChatMessage,
  ChatThread,
  Donor,
  DonorMatch,
  DonationRequest,
  DonorPrivate,
} from "@/backend/types";

export const SEARCH_RADIUS_KM = 25;

/** Normalizes a city name for equality matching (case/whitespace only, not fuzzy). */
export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

/* ---------------------------- geocoding --------------------------- */

export interface AddressLike {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

/**
 * Turns a profile address into coordinates using OpenStreetMap Nominatim
 * (already used by the map search). Tries the most specific query first and
 * falls back to PIN code, then city. Returns null if nothing resolves.
 */
export async function geocodeAddress(
  addr: AddressLike
): Promise<{ lat: number; lng: number } | null> {
  const country = addr.country?.trim() || "India";
  const attempts = [
    [addr.street, addr.city, addr.state, addr.pincode, country],
    [addr.pincode, addr.city, addr.state, country],
    [addr.pincode, country],
    [addr.city, addr.state, country],
  ]
    .map((parts) => parts.map((p) => (p || "").trim()).filter(Boolean).join(", "))
    .filter(Boolean);

  for (const q of attempts) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (rows[0]) {
        const lat = Number(rows[0].lat);
        const lng = Number(rows[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch {
      /* try the next, broader query */
    }
  }
  return null;
}

/* ------------------------------ donors ---------------------------- */

interface ProfileForDonor {
  uid: string;
  email?: string;
  name?: string;
  profilePhoto?: string | null;
  bloodType?: string;
  phone?: string;
  address?: AddressLike;
  /** Cached coords from a previous geocode, so we don't re-hit Nominatim. */
  lat?: number;
  lng?: number;
}

/**
 * Publishes (or refreshes) the signed-in user as a real donor.
 * Called when they open "Donate Blood" or "Need Blood" with a complete
 * profile. Public data goes to donors/{uid}; the phone number goes only to
 * donors_private/{uid}.
 */
export async function syncDonorFromProfile(
  p: ProfileForDonor
): Promise<
  { ok: true; lat: number; lng: number; cityKey: string } | { ok: false; reason: string }
> {
  if (!p.name?.trim()) return { ok: false, reason: "Add your name to your profile." };
  if (!p.bloodType) return { ok: false, reason: "Add your blood type to your profile." };
  if (!p.phone?.trim()) return { ok: false, reason: "Add your phone number to your profile." };
  if (!p.address?.city || !p.address?.pincode) {
    return { ok: false, reason: "Add your full address to your profile." };
  }

  const donorRef = doc(db, "donors", p.uid);
  const existing = await getDoc(donorRef);
  const prev = existing.exists() ? existing.data() : null;

  // A fingerprint of the address the stored coordinates were computed from.
  // If it hasn't changed we reuse them instead of hitting Nominatim (which asks
  // apps to stay near 1 request/second) on every page load.
  const addrKey = [p.address.street, p.address.city, p.address.state, p.address.pincode, p.address.country]
    .map((x) => (x || "").trim().toLowerCase())
    .join("|");

  let coords: { lat: number; lng: number } | null = null;
  if (typeof p.lat === "number" && typeof p.lng === "number") {
    coords = { lat: p.lat, lng: p.lng };
  } else if (prev && prev.addrKey === addrKey && typeof prev.lat === "number" && typeof prev.lng === "number") {
    coords = { lat: prev.lat, lng: prev.lng };
  } else {
    coords = await geocodeAddress(p.address);
  }
  if (!coords) {
    return {
      ok: false,
      reason: "We couldn't find your address on the map. Check your PIN code and city in your profile.",
    };
  }

  const now = Date.now();

  const publicDoc: Record<string, unknown> = {
    name: p.name.trim(),
    email: p.email ?? "",
    profilePhoto: p.profilePhoto ?? null,
    bloodType: p.bloodType,
    lat: coords.lat,
    lng: coords.lng,
    geohash: encodeGeohash(coords.lat, coords.lng),
    geohashWide: encodeWideGeohash(coords.lat, coords.lng),
    city: p.address.city.trim(),
    // Lowercased/trimmed so "Kanpur", "kanpur ", "KANPUR" all match on
    // equality queries. `city` above stays as-typed for display.
    cityKey: normalizeCityKey(p.address.city),
    addrKey,
    available: prev ? prev.available !== false : true,
    createdAt: prev ? prev.createdAt ?? now : now,
    updatedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(donorRef, publicDoc, { merge: true });
  batch.set(doc(db, "donors_private", p.uid), {
    uid: p.uid,
    phone: p.phone.trim(),
    updatedAt: now,
  } satisfies DonorPrivate);
  await batch.commit();

  return { ok: true, lat: coords.lat, lng: coords.lng, cityKey: publicDoc.cityKey as string };
}

/** Lets a donor pause/resume being listed without deleting anything. */
export async function setDonorAvailability(uid: string, available: boolean) {
  await updateDoc(doc(db, "donors", uid), { available, updatedAt: Date.now() });
}

/**
 * Real nearby-donor search: same blood type, inside the geohash cells around
 * the point, filtered to a true radius, nearest first. The signed-in user is
 * excluded so nobody can request blood from themselves.
 */
export async function findNearbyDonors(
  bloodType: BloodType,
  lat: number,
  lng: number,
  excludeUid: string
): Promise<DonorMatch[]> {
  const cells = wideGeohashSearchCells(lat, lng);
  const snaps = await Promise.all(
    cells.map((cell) =>
      getDocs(
        query(
          collection(db, "donors"),
          where("bloodType", "==", bloodType),
          where("geohashWide", "==", cell)
        )
      )
    )
  );

  const seen = new Set<string>();
  const out: DonorMatch[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (seen.has(d.id) || d.id === excludeUid) continue;
      seen.add(d.id);
      const donor = { uid: d.id, ...d.data() } as Donor;
      if (donor.available === false) continue;
      const distanceKm = haversineDistanceKm(lat, lng, donor.lat, donor.lng);
      if (distanceKm <= SEARCH_RADIUS_KM) out.push({ ...donor, distanceKm });
    }
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ----------------------------- requests --------------------------- */

export const requestIdFor = (requesterUid: string, donorUid: string) =>
  `${requesterUid}_${donorUid}`;

export interface CreateRequestInput {
  requesterUid: string;
  requesterName: string;
  requesterPhoto?: string | null;
  /** Shared with the donor only after they approve. */
  requesterPhone?: string;
  donor: DonorMatch;
  bloodType: BloodType;
  units: number;
  urgent: boolean;
  hospital: string;
  lat: number;
  lng: number;
  /** Requester's own city (from their profile), used for the city-wide feed. */
  city: string;
}

/**
 * Sends a request to one specific donor and notifies them.
 * The deterministic id + create-only rule mean a duplicate is rejected by the
 * database itself rather than trusted to the UI.
 */
export async function createDonationRequest(input: CreateRequestInput): Promise<string> {
  const id = requestIdFor(input.requesterUid, input.donor.uid);
  const now = Date.now();

  const request: Omit<DonationRequest, "id"> = {
    requesterUid: input.requesterUid,
    requesterName: input.requesterName,
    requesterPhoto: input.requesterPhoto ?? null,
    donorUid: input.donor.uid,
    donorName: input.donor.name,
    donorPhoto: input.donor.profilePhoto ?? null,
    bloodType: input.bloodType,
    units: input.units,
    urgent: input.urgent,
    hospital: input.hospital,
    lat: input.lat,
    lng: input.lng,
    geohash: encodeGeohash(input.lat, input.lng),
    city: input.city,
    cityKey: normalizeCityKey(input.city),
    status: "pending",
    threadId: null,
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, "requests", id), request);
  batch.set(doc(collection(db, "notifications")), {
    uid: input.donor.uid,
    title: input.urgent ? "Urgent blood request" : "New blood request",
    body: `${input.requesterName} needs ${input.bloodType} blood at ${input.hospital}.`,
    tone: "info",
    read: false,
    createdAt: now,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();

  // The requester's number goes into the request's own contacts subcollection.
  // The rules let the donor read it only after approving, never while pending.
  // (Separate write: the rule needs the parent request to exist first.)
  await publishOwnContact(id, input.requesterUid, input.requesterPhone);
  return id;
}

/** Writes this person's phone into requests/{id}/contacts/{uid}. Best-effort: a
 *  missing number just means no Call button, chat still works. */
async function publishOwnContact(requestId: string, uid: string, phone?: string) {
  if (!phone?.trim()) return;
  try {
    await setDoc(doc(db, "requests", requestId, "contacts", uid), {
      uid,
      phone: phone.trim(),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn("Could not publish contact number:", e);
  }
}

/** Requests this user has SENT (Need Blood side). Live. */
export function subscribeSentRequests(
  uid: string,
  cb: (rows: DonationRequest[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "requests"), where("requesterUid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DonationRequest)),
    (e) => onError?.(e)
  );
}

/** Requests sent TO this user as a donor (Donate Blood side). Live. */
export function subscribeIncomingRequests(
  uid: string,
  cb: (rows: DonationRequest[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "requests"), where("donorUid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DonationRequest)),
    (e) => onError?.(e)
  );
}

/**
 * Browse feed for Donate Blood.
 *
 * CITY IS A BACKEND VISIBILITY CONSTRAINT:
 * every browse request must belong to the signed-in user's city.
 *
 * "ALL" means all blood groups, but still ONLY this city.
 * "nearby" applies the distance filter in the UI after this city-scoped
 * subscription has delivered the pending requests.
 */
export function subscribeCityPendingRequests(
  cityKey: string,
  bloodType: "ALL" | BloodType,
  myUid: string,
  cb: (rows: DonationRequest[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "requests"),
      where("cityKey", "==", cityKey),
      where("status", "==", "pending")
    ),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as DonationRequest)
        .filter(
          (r) =>
            r.donorUid !== myUid &&
            r.requesterUid !== myUid &&
            (bloodType === "ALL" || r.bloodType === bloodType)
        );

      cb(rows);
    },
    (e) => onError?.(e)
  );
}

/**
 * ALL pending requests, any city, excluding my own/addressed-to-me ones.
 * Backs "All requests" mode. Firestore has no "not equal to two things"
 * query, so this fetches every pending request and filters client-side —
 * acceptable at RaktJaal's scale. If this ever needs to scale further,
 * paginate with a createdAt cursor.
 */
export function subscribeAllPendingRequests(
  myUid: string,
  cb: (rows: DonationRequest[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "requests"), where("status", "==", "pending")),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as DonationRequest)
        .filter((r) => r.requesterUid !== myUid);
      cb(rows);
    },
    (e) => onError?.(e)
  );
}

/**
 * Donor approves: flips the request, opens the chat thread, and notifies the
 * requester. One atomic batch, so we never end up "approved" with no thread.
 */
export async function approveRequest(req: DonationRequest): Promise<void> {
  const now = Date.now();
  const threadId = req.id;
  const batch = writeBatch(db);

  batch.update(doc(db, "requests", req.id), {
    status: "approved",
    threadId,
    approvedAt: now,
    updatedAt: now,
  });
  batch.set(doc(db, "threads", threadId), {
    participants: [req.requesterUid, req.donorUid],
    names: { [req.requesterUid]: req.requesterName, [req.donorUid]: req.donorName },
    photos: { [req.requesterUid]: req.requesterPhoto ?? null, [req.donorUid]: req.donorPhoto ?? null },
    context: `${req.bloodType} · ${req.hospital}`,
    requestId: req.id,
    unread: { [req.requesterUid]: 0, [req.donorUid]: 0 },
    createdAt: now,
  } satisfies Omit<ChatThread, "id">);
  batch.set(doc(collection(db, "notifications")), {
    uid: req.requesterUid,
    title: `${req.donorName} approved your request`,
    body: "You can now message or call them directly.",
    tone: "success",
    read: false,
    createdAt: now,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();

  // Donor's number is released to the requester now that they've approved.
  // Uses the private copy kept from the profile sync.
  try {
    const mine = await getDoc(doc(db, "donors_private", req.donorUid));
    const phone = mine.exists() ? (mine.data() as DonorPrivate).phone : undefined;
    await publishOwnContact(req.id, req.donorUid, phone);
  } catch (e) {
    console.warn("Could not publish donor contact number:", e);
  }
}

export async function declineRequest(req: DonationRequest): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, "requests", req.id), { status: "declined", updatedAt: now });
  batch.set(doc(collection(db, "notifications")), {
    uid: req.requesterUid,
    title: "Request declined",
    body: `${req.donorName} can't donate right now. Try another donor.`,
    tone: "info",
    read: false,
    createdAt: now,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();
}

/**
 * Requester re-opens a request they earlier cancelled, and pings the donor again.
 * Only status/updatedAt change (the rules forbid touching anything else).
 */
export async function reopenRequest(req: DonationRequest): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, "requests", req.id), { status: "pending", updatedAt: now });
  batch.set(doc(collection(db, "notifications")), {
    uid: req.donorUid,
    title: req.urgent ? "Urgent blood request" : "New blood request",
    body: `${req.requesterName} needs ${req.bloodType} blood at ${req.hospital}.`,
    tone: "info",
    read: false,
    createdAt: now,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();
}

/** Requester withdraws a still-pending request. */
export async function cancelRequest(req: DonationRequest): Promise<void> {
  await updateDoc(doc(db, "requests", req.id), {
    status: "cancelled",
    updatedAt: Date.now(),
  });
}

/**
 * The OTHER person's phone number for an approved request. Works the same in
 * both directions (donor -> requester and requester -> donor). Firestore rules
 * only allow the read once the request is approved, so calling this early
 * simply returns null.
 */
/**
 * Called by EITHER side of an approved request to confirm the donation
 * actually happened. This only ever writes the CALLER's own confirmation
 * timestamp (donorConfirmedAt or requesterConfirmedAt) — a normal,
 * rule-safe update to a document the caller is already a party to.
 *
 * It never writes to the other person's profile or flips donationVerified
 * itself. After writing its own timestamp, it always pings the server route
 * `/api/donation/verified`, which checks (server-side, with the Admin SDK)
 * whether BOTH timestamps are now present, and if so does the privileged
 * work atomically: flips donationVerified, writes both users' donation
 * history, and emails both parties. Safe to call from both sides even if
 * they race — the server route is idempotent (see its own comments).
 */
export async function confirmDonation(
  req: DonationRequest,
  byUid: string
): Promise<void> {
  if (req.status !== "approved") {
    throw new Error("This request hasn't been approved yet.");
  }

  if (byUid !== req.donorUid && byUid !== req.requesterUid) {
    throw new Error("You're not part of this request.");
  }

  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch("/api/donation/verified", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      requestId: req.id,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error || "Couldn't confirm the donation."
    );
  }
}


export async function getContactPhone(requestId: string, otherUid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "requests", requestId, "contacts", otherUid));
    return snap.exists() ? ((snap.data() as { phone?: string }).phone ?? null) : null;
  } catch {
    return null;
  }
}

/* ------------------------------ threads --------------------------- */

export function subscribeThreads(
  uid: string,
  cb: (rows: ChatThread[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "threads"), where("participants", "array-contains", uid)),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatThread);
      rows.sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
      cb(rows);
    },
    (e) => onError?.(e)
  );
}

export function subscribeMessages(
  threadId: string,
  cb: (rows: ChatMessage[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "threads", threadId, "messages"), orderBy("createdAt", "asc"), limit(500)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)),
    (e) => onError?.(e)
  );
}

export interface OutgoingMessage {
  type: "text" | "image" | "file";
  text?: string;
  url?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

/** Firestore docs cap at 1 MiB; attachments are inlined as data URLs, so keep them well under that. */
export const MAX_INLINE_ATTACHMENT_BYTES = 700 * 1024;

export async function sendMessage(
  thread: ChatThread,
  fromUid: string,
  msg: OutgoingMessage
): Promise<void> {
  const other = thread.participants.find((p) => p !== fromUid);
  const now = Date.now();
  const preview =
    msg.type === "image" ? "📷 Photo" : msg.type === "file" ? `📎 ${msg.name ?? "File"}` : msg.text ?? "";

  const clean: Record<string, unknown> = { from: fromUid, type: msg.type, createdAt: now };
  for (const k of ["text", "url", "name", "size", "mimeType"] as const) {
    if (msg[k] !== undefined) clean[k] = msg[k];
  }

  const batch = writeBatch(db);
  batch.set(doc(collection(db, "threads", thread.id, "messages")), clean);
  batch.update(doc(db, "threads", thread.id), {
    lastMessage: preview.slice(0, 120),
    lastMessageAt: now,
    ...(other ? { [`unread.${other}`]: increment(1) } : {}),
  });
  await batch.commit();
}

/**
 * Backfills the photos map on an older thread (created before threads
 * stored photos) so its avatars stop falling back to initials. Best-effort
 * and idempotent — safe to call every time a thread is opened.
 */
export async function backfillThreadPhotos(thread: ChatThread): Promise<void> {
  try {
    const missing = thread.participants.filter((uid) => thread.photos?.[uid] === undefined);
    if (missing.length === 0) return;
    const profiles = await Promise.all(missing.map((uid) => getUserProfile(uid)));
    const patch: Record<string, string | null> = {};
    missing.forEach((uid, i) => {
      patch[uid] = profiles[i]?.profilePhoto ?? null;
    });
    await updateDoc(doc(db, "threads", thread.id), {
      photos: { ...(thread.photos || {}), ...patch },
    });
  } catch (e) {
    console.warn("Could not backfill thread photos:", e);
  }
}

export async function markThreadRead(threadId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "threads", threadId), { [`unread.${uid}`]: 0 });
  } catch {
    /* non-critical */
  }
}

/* --------------------------- notifications ------------------------ */

export function subscribeNotifications(
  uid: string,
  cb: (rows: AppNotification[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notifications"), where("uid", "==", uid), limit(50)),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
      rows.sort((a, b) => b.createdAt - a.createdAt);
      cb(rows);
    },
    (e) => onError?.(e)
  );
}

export async function markAllNotificationsRead(uid: string, rows: AppNotification[]) {
  const unread = rows.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const n of unread) batch.update(doc(db, "notifications", n.id), { read: true });
  await batch.commit();
}

/** Small helper so UI can show "5 min ago" instead of a raw timestamp. */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}
