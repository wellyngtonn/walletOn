"use client";

import { useEffect, useRef, useState } from "react";
import { syncPierreData } from "@/services/pierre-sync";

export const PIERRE_API_KEY_STORAGE = "wallet-pierre-api-key";
const PIERRE_SYNC_EVENT = "wallet-pierre-sync-complete";
const PIERRE_SYNC_STORAGE = "wallet-pierre-sync-complete";

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
  apiKey,
  preferredAccountId,
  profileLoading,
}: {
  uid?: string;
  apiKey: string | null;
  preferredAccountId?: string | null;
  profileLoading: boolean;
}) {
  const startedForUid = useRef<string | null>(null);

  useEffect(() => {
    if (
      !uid ||
      !apiKey ||
      profileLoading ||
      startedForUid.current === uid
    ) return;
    startedForUid.current = uid;
    void syncPierreData(uid, apiKey, preferredAccountId)
      .then(() => markPierreSyncComplete())
      .catch(() => {
        // A falha silenciosa evita bloquear a abertura do app.
      });
  }, [apiKey, preferredAccountId, profileLoading, uid]);
}
