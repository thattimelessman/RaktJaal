export type BloodType =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";

export const BLOOD_TYPES: BloodType[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

export type Urgency = "low" | "medium" | "critical";

export interface Donor {
  /** Firestore doc id === Firebase Auth uid (email/password or Google). */
  uid: string;
  name: string;
  email: string;
  /** Profile photo shown on signed-in donor/request cards. */
  profilePhoto?: string | null;
  /**
   * Legacy: written by /donor/signup. Docs created by the main app flow
   * (syncDonorFromProfile) deliberately leave this empty and keep the number
   * in donors_private/{uid} instead, so it is never world-readable.
   */
  phone?: string;
  bloodType: BloodType;
  lat: number;
  lng: number;
  geohash: string;
  authProvider?: "password" | "google.com";
  createdAt: number;
  lastDonationAt?: number | null;
  /** Precision-4 geohash: what the wide "near me" search queries on. */
  geohashWide?: string;
  /** City shown on donor cards. */
  city?: string;
  /** Normalized (lowercased/trimmed) city, used for equality queries. */
  cityKey?: string;
  /** Donor can switch themselves off without deleting their profile. */
  available?: boolean;
  updatedAt?: number;
}

export interface BloodRequest {
  id?: string;
  bloodType: BloodType;
  units: number;
  hospital: string;
  lat: number;
  lng: number;
  geohash: string;
  urgency: Urgency;
  contactNumber: string;
  contactName?: string;
  notes?: string;
  status: "open" | "fulfilled" | "expired";
  createdAt: number;
}

export interface DonorMatch extends Donor {
  distanceKm: number;
  /** 0 = same blood group, 1 = compatible group, 2 = other group (can still help, e.g. family / blood bank). */
  matchRank?: 0 | 1 | 2;
}

/* ------------------------------------------------------------------
   Real request -> approval -> chat pipeline (Firestore-backed).
------------------------------------------------------------------- */

export type DonationRequestStatus = "pending" | "approved" | "declined" | "cancelled";

/**
 * One person asking one specific donor for blood.
 * Doc id is deterministic: `${requesterUid}_${donorUid}` so the same person
 * can't create duplicates and the security rules can address it by id.
 */
export interface DonationRequest {
  id: string;
  requesterUid: string;
  requesterName: string;
  requesterPhoto?: string | null;
  /** null for an OPEN request until a donor accepts it. */
  donorUid: string | null;
  donorName: string | null;
  donorPhoto?: string | null;
  bloodType: BloodType;
  units: number;
  urgent: boolean;
  hospital: string;
  lat: number;
  lng: number;
  geohash: string;
  /** City the request was made from (requester's own profile city, as typed). */
  city: string;
  /** Normalized city, used to query "all requests in my city". */
  cityKey: string;
  status: DonationRequestStatus;
  /** Set once approved; equals the request id. */
  threadId?: string | null;
  /** Set once the donor approves the request. */
  approvedAt?: number;
  createdAt: number;
  updatedAt: number;
  /**
   * Set once BOTH the donor and requester have confirmed the donation
   * actually happened. Until then this is absent/false, even if one side
   * has already confirmed (see donorConfirmedAt / requesterConfirmedAt).
   */
  donationVerified?: boolean;
  donationVerifiedAt?: number;
  /** Timestamp each side confirmed, independently. Either can confirm first. */
  donorConfirmedAt?: number;
  requesterConfirmedAt?: number;
}

/** Thread participants are exactly the two people on the request. */
export interface ChatThread {
  id: string;
  participants: [string, string];
  names: Record<string, string>;
  /** uid -> profile photo (data URL or null), so chat avatars show real photos. */
  photos?: Record<string, string | null>;
  context: string;
  requestId: string;
  lastMessage?: string;
  lastMessageAt?: number;
  /** uid -> number of unread messages for that uid. */
  unread?: Record<string, number>;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  type: "text" | "image" | "file";
  text?: string;
  url?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  uid: string;
  title: string;
  body: string;
  tone: "info" | "success";
  read: boolean;
  createdAt: number;
  /** What tapping the notification does (optional: older ones just aren't actionable). */
  kind?: "incoming-request" | "open-request" | "thread" | "sent-update" | "confirm-donation" | "history" | "profile";
  requestId?: string;
  threadId?: string;
}

/** Contact details released only to the counter-party of an approved request. */
export interface DonorPrivate {
  uid: string;
  phone: string;
  updatedAt: number;
}

/**
 * One completed, mutually-verified donation, written into the profile of
 * BOTH people once donationVerified flips true on the underlying request.
 * `role` tells the profile which side this person was on, so "Donated" and
 * "Received" can be shown as separate logs from the same array.
 */
export interface DonationLogEntry {
  requestId: string;
  role: "donor" | "requester";
  /** The OTHER person on this donation. */
  counterpartUid: string;
  counterpartName: string;
  /** Snapshot of the counterpart's profile photo and phone at verification
   *  time, so the history detail view can show them without another read. */
  counterpartPhoto?: string | null;
  counterpartPhone?: string | null;
  bloodType: BloodType;
  units: number;
  hospital: string;
  city: string;
  lat: number;
  lng: number;
  /** When the request was first created. */
  requestedAt?: number;
  /** When the donor approved the request (chat/contact opened up). */
  acceptedAt?: number;
  /** When BOTH sides had confirmed the donation actually happened. */
  verifiedAt: number;
}
