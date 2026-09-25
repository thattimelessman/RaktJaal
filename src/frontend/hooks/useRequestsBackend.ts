"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveRequest,
  declineRequest,
  cancelRequest,
  reopenRequest,
  markAllNotificationsRead,
  markThreadRead,
  sendMessage,
  subscribeIncomingRequests,
  subscribeNotifications,
  subscribeSentRequests,
  subscribeThreads,
  syncDonorFromProfile,
  type OutgoingMessage,
} from "@/backend/lib/requests";
import type {
  AppNotification,
  ChatThread,
  DonationRequest,
} from "@/backend/types";

export interface DonorSyncState {
  status: "idle" | "syncing" | "ready" | "error";
  reason?: string;
  lat?: number;
  lng?: number;
}

interface ProfileLike {
  uid: string;
  email?: string;
  name?: string;
  bloodType?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  lat?: number;
  lng?: number;
}

/**
 * One place that owns everything live on /action:
 *  - publishes the signed-in user as a real donor (when their profile is complete)
 *  - subscribes to requests they sent, requests sent to them, threads, notifications
 * All of it is onSnapshot, so a change made from another account shows up here
 * without a refresh.
 */
export function useRequestsBackend(profile: ProfileLike | null, profileComplete: boolean) {
  const uid = profile?.uid ?? null;

  const [sent, setSent] = useState<DonationRequest[]>([]);
  const [incoming, setIncoming] = useState<DonationRequest[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // True once the notifications subscription has delivered its first result,
  // so the UI can tell "already existed at load" apart from "just arrived".
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [donorSync, setDonorSync] = useState<DonorSyncState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Publish this user as a donor whenever their profile is complete/changes.
  // Keyed on the fields that affect the donor card so it doesn't re-run on every render.
  const syncKey = profile
    ? [
        profile.uid,
        profile.name,
        profile.bloodType,
        profile.phone,
        profile.address?.street,
        profile.address?.city,
        profile.address?.state,
        profile.address?.pincode,
      ].join("|")
    : "";

  useEffect(() => {
    if (!profile || !profileComplete) {
      setDonorSync({ status: "idle" });
      return;
    }
    let cancelled = false;
    setDonorSync({ status: "syncing" });
    syncDonorFromProfile(profile)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setDonorSync({ status: "ready", lat: res.lat, lng: res.lng });
        else setDonorSync({ status: "error", reason: res.reason });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setDonorSync({
          status: "error",
          reason: e instanceof Error ? e.message : "Couldn't publish your donor profile.",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, profileComplete]);

  // Live subscriptions.
  useEffect(() => {
    if (!uid) {
      setSent([]);
      setIncoming([]);
      setThreads([]);
      setNotifications([]);
      setNotificationsReady(false);
      return;
    }
    setNotificationsReady(false);
    const onErr = (e: Error) => setError(e.message);
    const unsubs = [
      subscribeSentRequests(uid, setSent, onErr),
      subscribeIncomingRequests(uid, setIncoming, onErr),
      subscribeThreads(uid, setThreads, onErr),
      subscribeNotifications(
        uid,
        (rows) => {
          setNotifications(rows);
          setNotificationsReady(true);
        },
        onErr
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const threadById = useMemo(() => new Map(threads.map((t) => [t.id, t])), [threads]);

  const approve = useCallback((req: DonationRequest) => approveRequest(req), []);
  const decline = useCallback((req: DonationRequest) => declineRequest(req), []);
  const cancel = useCallback((req: DonationRequest) => cancelRequest(req), []);
  const reopen = useCallback((req: DonationRequest) => reopenRequest(req), []);

  const send = useCallback(
    async (threadId: string, msg: OutgoingMessage) => {
      const t = threadById.get(threadId);
      if (!t || !uid) throw new Error("Conversation not found.");
      await sendMessage(t, uid, msg);
    },
    [threadById, uid]
  );

  const markRead = useCallback(
    (threadId: string) => (uid ? markThreadRead(threadId, uid) : Promise.resolve()),
    [uid]
  );

  const markAllRead = useCallback(
    () => (uid ? markAllNotificationsRead(uid, notifications) : Promise.resolve()),
    [uid, notifications]
  );

  return {
    sent,
    incoming,
    threads,
    notifications,
    notificationsReady,
    donorSync,
    error,
    approve,
    decline,
    cancel,
    reopen,
    send,
    markRead,
    markAllRead,
  };
}
