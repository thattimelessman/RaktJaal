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
  donorUid: string;
  donorName: string;
  bloodType: BloodType;
  units: number;
  urgent: boolean;
  hospital: string;
  lat: number;
  lng: number;
  geohash: string;
  status: DonationRequestStatus;
  /** Set once approved; equals the request id. */
  threadId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Thread participants are exactly the two people on the request. */
export interface ChatThread {
  id: string;
  participants: [string, string];
  names: Record<string, string>;
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
}

/** Contact details released only to the counter-party of an approved request. */
export interface DonorPrivate {
  uid: string;
  phone: string;
  updatedAt: number;
}
