/* -----------------------------------------------------------------
   authStore.js — PLACEHOLDER for a real backend.

   There is no database yet. This is a tiny local "directory" that
   keeps each email's profile separate, so different users actually
   get different (or freshly-empty) data instead of one shared slot.

   Swap this whole file for real calls once a backend exists:
     getDirectoryEntry(email)  -> supabase.from('profiles').select().eq('email', email)
     saveDirectoryEntry(email) -> supabase.from('profiles').upsert(...)
     getCurrentUser()          -> supabase.auth.getUser()
     setCurrentUser(email)     -> supabase.auth.signInWithPassword(...)
   Nothing in AuthPage.jsx or ProfilePage.jsx needs to know the
   difference — they only ever call the functions below.
-------------------------------------------------------------------- */

const DIRECTORY_KEY = "raktjaal_directory"; // { [email]: profileObject }, localStorage
const SESSION_KEY = "raktjaal_session_email"; // just the logged-in email, sessionStorage

function readDirectory() {
  try {
    const raw = localStorage.getItem(DIRECTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDirectory(dir) {
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
}

/** Look up a stored profile by email. Returns null if this email has never been seen. */
export function getDirectoryEntry(email) {
  if (!email) return null;
  const dir = readDirectory();
  return dir[email.toLowerCase()] || null;
}

/** Create or update a profile for a given email. Never touches other emails' data. */
export function saveDirectoryEntry(email, data) {
  if (!email) return;
  const dir = readDirectory();
  dir[email.toLowerCase()] = { ...dir[email.toLowerCase()], ...data, email };
  writeDirectory(dir);
}

/** Called by RegisterForm — always writes what the person actually typed, no guard. */
export function registerUser(profile) {
  if (!profile?.email) throw new Error("registerUser requires an email");
  saveDirectoryEntry(profile.email, profile);
  sessionStorage.setItem(SESSION_KEY, profile.email.toLowerCase());
}

/**
 * Called by LoginForm. Looks up this exact email in the directory.
 * - Known email  -> logs them into their own saved profile.
 * - Unknown email -> starts a fresh, empty profile for THIS email
 *   (never reuses another email's leftover data).
 * Either way, the previous session's data is gone the moment a
 * different email logs in.
 */
export function loginUser(email) {
  if (!email) throw new Error("loginUser requires an email");
  const existing = getDirectoryEntry(email);
  if (!existing) {
    saveDirectoryEntry(email, { email }); // fresh, empty — nothing assumed
  }
  sessionStorage.setItem(SESSION_KEY, email.toLowerCase());
}

/** What ProfilePage reads. Returns null if nobody is logged in this session. */
export function getCurrentUser() {
  const email = sessionStorage.getItem(SESSION_KEY);
  if (!email) return null;
  return getDirectoryEntry(email) || { email };
}

/** What ProfilePage's Save button calls. Updates only the logged-in user's entry. */
export function saveCurrentUser(updatedFields) {
  const email = sessionStorage.getItem(SESSION_KEY);
  if (!email) return;
  saveDirectoryEntry(email, updatedFields);
}

/** Logout clears only the "who's logged in" pointer — the directory itself is untouched. */
export function clearCurrentUser() {
  sessionStorage.removeItem(SESSION_KEY);
}