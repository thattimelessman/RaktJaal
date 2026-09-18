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
  phone: string;
  bloodType: BloodType;
  lat: number;
  lng: number;
  geohash: string;
  authProvider: "password" | "google.com";
  createdAt: number;
  lastDonationAt?: number | null;
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
