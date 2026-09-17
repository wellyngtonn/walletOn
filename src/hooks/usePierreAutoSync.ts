"use client";

import { useEffect, useRef, useState } from "react";
import { syncPierreData } from "@/services/pierre-sync";

const PIERRE_SYNC_EVENT = "wallet-pierre-sync-complete";
const PIERRE_SYNC_STORAGE = "wallet-pierre-sync-complete";
const MIN_RESUME_SYNC_INTERVAL_MS = 60_000;

export function markPierreSyncComplete() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PIERRE_SYNC_STORAGE, "1");
  window.dispatchEvent(new Event(PIERRE_SYNC_EVENT));
}

export function usePierreSyncStatus() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const update = () => {
      setSynced(window.sessionStorage.getItem(PIERRE_SYNC_STORAGE) === "1");
    };
    update();
    window.addEventListener(PIERRE_SYNC_EVENT, update);
    return () => window.removeEventListener(PIERRE_SYNC_EVENT, update);
  }, []);

  return synced;
}

export function usePierreAutoSync({
  uid,
  hasApiKey,
  preferredAccountId,
  profileLoading,
}: {
  uid?: string;
  hasApiKey: boolean;
  preferredAccountId?: string | null;
  profileLoading: boolean;
}) {
  const startedForUid = useRef<string | null>(null);
  const syncing = useRef(false);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!uid || !hasApiKey || profileLoading) return;

    const runSync = () => {
      if (syncing.current) return;
      syncing.current = true;
      lastSyncAt.current = Date.now();
      void syncPierreData(preferredAccountId)
        .then(() => markPierreSyncComplete())
        .catch(() => {
          // A falha silenciosa evita bloquear a abertura do app.
        })
        .finally(() => {
          syncing.current = false;
        });
    };

    if (startedForUid.current !== uid) {
      startedForUid.current = uid;
      runSync();
    }

    const handleResume = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncAt.current < MIN_RESUME_SYNC_INTERVAL_MS) return;
      runSync();
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, [hasApiKey, preferredAccountId, profileLoading, uid]);
}
