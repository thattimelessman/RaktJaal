/* -----------------------------------------------------------------
   requests.ts: the real, Firestore-backed pipeline behind /action.

     donors/{uid}                 public donor card (no phone)
     donors_private/{uid}         phone, released only after approval
     requests/{requesterUid}_{donorUid}
                                  one person asking one donor for blood
     requests/{requesterUid}_open_{ts}
                                  OPEN request, donorUid null until a donor accepts
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

/**
 * Profile photos are stored as base64 data URLs (up to ~530 KB each). A request
 * doc embeds two of them and a Firestore doc is capped at 1 MiB, so two large
 * photos made the write fail outright. Only inline a photo when it is small;
 * otherwise store null and the UI falls back to initials.
 */
const MAX_INLINE_PHOTO_CHARS = 120 * 1024;
export function safePhoto(photo?: string | null): string | null {
  return photo && photo.length <= MAX_INLINE_PHOTO_CHARS ? photo : null;
}

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
 * Real nearby-donor search: all blood groups (same group ranked first), inside the geohash cells around
 * the point, filtered to a true radius, nearest first. The signed-in user is
 * excluded so nobody can request blood from themselves.
 */
export async function findNearbyDonors(
  bloodType: BloodType,
  lat: number,
  lng: number,
  excludeUid: string
): Promise<DonorMatch[]> {
  // Every registered donor nearby is listed, whatever their own blood group:
  // a family member or a blood bank can help with any group. Same-group and
  // compatible donors are ranked first (see rankOf below).
  const cells = wideGeohashSearchCells(lat, lng);
  const snaps = await Promise.all(
    cells.map((cell) =>
      getDocs(query(collection(db, "donors"), where("geohashWide", "==", cell)))
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
      if (distanceKm <= SEARCH_RADIUS_KM) {
        out.push({ ...donor, distanceKm, matchRank: rankOf(donor.bloodType, bloodType) });
      }
    }
  }
  return out.sort(
    (a, b) => (a.matchRank ?? 2) - (b.matchRank ?? 2) || a.distanceKm - b.distanceKm
  );
}

/** Which recipient groups each donor group can give red cells to. */
const CAN_GIVE_TO: Record<string, string[]> = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

function rankOf(donorType: string | undefined, needed: string): 0 | 1 | 2 {
  if (donorType === needed) return 0;
  return donorType && CAN_GIVE_TO[donorType]?.includes(needed) ? 1 : 2;
}

/** One donor's public card by uid (used to show a donor who accepted from far away). */
export async function getDonorCard(uid: string): Promise<Donor | null> {
  try {
    const snap = await getDoc(doc(db, "donors", uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as Donor) : null;
  } catch {
    return null;
  }
}

/** Keeps the public donor card's photo current (best-effort; no card yet = nothing to update). */
export async function syncMyDonorPhoto(uid: string, photo: string | null): Promise<void> {
  try {
    await updateDoc(doc(db, "donors", uid), { profilePhoto: photo, updatedAt: Date.now() });
  } catch {
    /* no donor card yet, it is created with the current photo on first sync */
  }
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
    requesterPhoto: safePhoto(input.requesterPhoto),
    donorUid: input.donor.uid,
    donorName: input.donor.name,
    donorPhoto: safePhoto(input.donor.profilePhoto),
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
    kind: "incoming-request",
    requestId: id,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();

  // The requester's number goes into the request's own contacts subcollection.
  // The rules let the donor read it only after approving, never while pending.
  // (Separate write: the rule needs the parent request to exist first.)
  await publishOwnContact(id, input.requesterUid, input.requesterPhone);

  // Email the donor too (best-effort; in-app notification is already written above).
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) {
      void fetch("/api/email/request-received", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ requestId: id }),
      }).catch(() => {});
    }
  } catch {
    /* best-effort */
  }

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

export interface CreateOpenRequestInput {
  requesterUid: string;
  requesterName: string;
  requesterPhoto?: string | null;
  requesterPhone?: string;
  bloodType: BloodType;
  units: number;
  urgent: boolean;
  hospital: string;
  lat: number;
  lng: number;
  city: string;
  /** Matching donors nearby who should get an in-app notification. */
  notifyDonorUids?: string[];
  /** The requester's own still-pending open requests; superseded by this one. */
  supersede?: DonationRequest[];
}

/**
 * Publishes an OPEN request: not addressed to any one donor. It is written the
 * moment the requester submits, whether or not any donor is registered nearby,
 * so it always exists in Firestore and every signed-in user can see it while it
 * is pending. Any registered donor can accept it (acceptOpenRequest).
 * donorUid stays null until someone accepts.
 */
export async function createOpenRequest(input: CreateOpenRequestInput): Promise<string> {
  // Any registered donor may accept an open request, whatever their blood group.
  const now = Date.now();
  const id = `${input.requesterUid}_open_${now}`;

  const request: Omit<DonationRequest, "id"> = {
    requesterUid: input.requesterUid,
    requesterName: input.requesterName,
    requesterPhoto: safePhoto(input.requesterPhoto),
    donorUid: null,
    donorName: null,
    donorPhoto: null,
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

  // One live open request per person: withdraw the previous one so the feed
  // never fills up with stale duplicates when someone edits and resubmits.
  for (const old of input.supersede ?? []) {
    if (!old.donorUid && old.status === "pending") {
      batch.update(doc(db, "requests", old.id), { status: "cancelled", updatedAt: now });
    }
  }

  batch.set(doc(db, "requests", id), request);

  const uids = Array.from(new Set(input.notifyDonorUids ?? []))
    .filter((u) => u && u !== input.requesterUid)
    .slice(0, 20);
  for (const uid of uids) {
    batch.set(doc(collection(db, "notifications")), {
      uid,
      title: input.urgent ? "Urgent blood request nearby" : "New blood request nearby",
      body: `${input.requesterName} needs ${input.bloodType} blood at ${input.hospital}.`,
      tone: "info",
      read: false,
      createdAt: now,
      kind: "open-request",
      requestId: id,
    } satisfies Omit<AppNotification, "id">);
  }
  await batch.commit();

  await publishOwnContact(id, input.requesterUid, input.requesterPhone);
  return id;
}

/**
 * A donor accepts an OPEN request. One atomic batch: claim the request (rules
 * only allow this while donorUid is still null and the status is pending, so
 * two donors racing can't both win), open the chat thread, notify the requester.
 */
export async function acceptOpenRequest(
  req: DonationRequest,
  donor: { uid: string; name: string; photo?: string | null }
): Promise<void> {
  const now = Date.now();
  const threadId = req.id;
  const donorPhoto = safePhoto(donor.photo);
  const batch = writeBatch(db);

  batch.update(doc(db, "requests", req.id), {
    status: "approved",
    threadId,
    approvedAt: now,
    updatedAt: now,
    donorUid: donor.uid,
    donorName: donor.name,
    donorPhoto,
  });
  batch.set(doc(db, "threads", threadId), {
    participants: [req.requesterUid, donor.uid],
    names: { [req.requesterUid]: req.requesterName, [donor.uid]: donor.name },
    photos: { [req.requesterUid]: safePhoto(req.requesterPhoto), [donor.uid]: donorPhoto },
    context: `${req.bloodType} · ${req.hospital}`,
    requestId: req.id,
    unread: { [req.requesterUid]: 0, [donor.uid]: 0 },
    createdAt: now,
  } satisfies Omit<ChatThread, "id">);
  batch.set(doc(collection(db, "notifications")), {
    uid: req.requesterUid,
    title: `${donor.name} accepted your request`,
    body: "You can now message or call them directly.",
    tone: "success",
    read: false,
    createdAt: now,
    kind: "thread",
    requestId: req.id,
    threadId,
  } satisfies Omit<AppNotification, "id">);

  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string })?.code === "permission-denied") {
      throw new Error("Someone else already accepted this request, or it was withdrawn.");
    }
    throw e;
  }

  try {
    const mine = await getDoc(doc(db, "donors_private", donor.uid));
    const phone = mine.exists() ? (mine.data() as DonorPrivate).phone : undefined;
    await publishOwnContact(req.id, donor.uid, phone);
  } catch (e) {
    console.warn("Could not publish donor contact number:", e);
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
        .filter((r) => r.donorUid !== myUid && r.requesterUid !== myUid);
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
        .filter((r) => r.requesterUid !== myUid && r.donorUid !== myUid);
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
  if (!req.donorUid) throw new Error("This is an open request; use acceptOpenRequest.");
  const donorUid = req.donorUid;
  const donorName = req.donorName ?? "Donor";
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
    participants: [req.requesterUid, donorUid],
    names: { [req.requesterUid]: req.requesterName, [donorUid]: donorName },
    photos: { [req.requesterUid]: safePhoto(req.requesterPhoto), [donorUid]: safePhoto(req.donorPhoto) },
    context: `${req.bloodType} · ${req.hospital}`,
    requestId: req.id,
    unread: { [req.requesterUid]: 0, [donorUid]: 0 },
    createdAt: now,
  } satisfies Omit<ChatThread, "id">);
  batch.set(doc(collection(db, "notifications")), {
    uid: req.requesterUid,
    title: `${donorName} approved your request`,
    body: "You can now message or call them directly.",
    tone: "success",
    read: false,
    createdAt: now,
    kind: "thread",
    requestId: req.id,
    threadId,
  } satisfies Omit<AppNotification, "id">);
  await batch.commit();

  // Donor's number is released to the requester now that they've approved.
  // Uses the private copy kept from the profile sync.
  try {
    const mine = await getDoc(doc(db, "donors_private", donorUid));
    const phone = mine.exists() ? (mine.data() as DonorPrivate).phone : undefined;
    await publishOwnContact(req.id, donorUid, phone);
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
    body: `${req.donorName ?? "The donor"} can't donate right now. Try another donor.`,
    tone: "info",
    read: false,
    createdAt: now,
    kind: "sent-update",
    requestId: req.id,
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
  // Open requests have no addressed donor; they just go back on the public feed.
  if (req.donorUid) {
    batch.set(doc(collection(db, "notifications")), {
      uid: req.donorUid,
      title: req.urgent ? "Urgent blood request" : "New blood request",
      body: `${req.requesterName} needs ${req.bloodType} blood at ${req.hospital}.`,
      tone: "info",
      read: false,
      createdAt: now,
      kind: "incoming-request",
      requestId: req.id,
    } satisfies Omit<AppNotification, "id">);
  }
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

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

/** One request by id (pending requests are readable by any signed-in user). */
export async function getRequestById(id: string): Promise<DonationRequest | null> {
  const snap = await getDoc(doc(db, "requests", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DonationRequest) : null;
}

/**
 * Keeps this user's avatar in their chat threads current. Threads store a
 * snapshot of each participant's photo, so after a profile-photo change the
 * old one would show in the inbox forever. Best-effort and idempotent: only
 * writes threads whose stored photo differs from the current one.
 */
export async function syncMyThreadPhotos(
  threads: ChatThread[],
  uid: string,
  photo: string | null | undefined
): Promise<void> {
  const target = safePhoto(photo);
  const stale = threads.filter((t) => t.participants.includes(uid) && (t.photos?.[uid] ?? null) !== target);
  await Promise.all(
    stale.map((t) =>
      updateDoc(doc(db, "threads", t.id), { [`photos.${uid}`]: target }).catch((e) =>
        console.warn("Could not refresh thread photo:", e)
      )
    )
  );
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
