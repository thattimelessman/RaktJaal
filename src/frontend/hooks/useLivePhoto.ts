"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/backend/lib/firebase";

/**
 * Live profile photos.
 *
 * Requests, chat threads and donation-history entries each store a SNAPSHOT of
 * a person's photo from the moment they were created, so a later photo change
 * never reached the other account. The one place that always holds the current
 * photo is the public donor card (donors/{uid}), which every signed-in user can
 * read. This hook listens to that card, so every avatar for that person updates
 * on every screen the moment they change their photo.
 *
 * One Firestore listener per person, shared by every avatar that shows them.
 */
type Photo = string | null | undefined;
interface Entry {
  photo: Photo;
  listeners: Set<(p: Photo) => void>;
  unsub: () => void;
}
const store = new Map<string, Entry>();

export function useLivePhoto(uid: string | null | undefined, fallback?: string | null): string | null {
  const [live, setLive] = useState<Photo>(() => (uid ? store.get(uid)?.photo : undefined));

  useEffect(() => {
    if (!uid) return;
    let entry = store.get(uid);
    if (!entry) {
      const created: Entry = { photo: undefined, listeners: new Set(), unsub: () => {} };
      created.unsub = onSnapshot(
        doc(db, "donors", uid),
        (snap) => {
          // No donor card yet -> undefined -> fall back to the stored snapshot.
          const p: Photo = snap.exists() ? ((snap.data().profilePhoto as string | null | undefined) ?? null) : undefined;
          created.photo = p;
          created.listeners.forEach((l) => l(p));
        },
        () => {}
      );
      store.set(uid, created);
      entry = created;
    }
    const listener = (p: Photo) => setLive(p);
    entry.listeners.add(listener);
    setLive(entry.photo);
    const e = entry;
    return () => {
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        e.unsub();
        store.delete(uid);
      }
    };
  }, [uid]);

  if (live === undefined) return fallback ?? null;
  return live; // string, or null when the person removed their photo
}
