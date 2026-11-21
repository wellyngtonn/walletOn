"use client";

import { useEffect, useRef, useState } from "react";
import { syncBankData } from "@/services/bank";
import type { BankProvider } from "@/utils/bank";

const BANK_SYNC_EVENT = "wallet-bank-sync-complete";
const BANK_SYNC_STORAGE = "wallet-bank-sync-complete";
const LEGACY_SYNC_STORAGE = "wallet-pierre-sync-complete";
const MIN_RESUME_SYNC_INTERVAL_MS = 60_000;

export function markBankSyncComplete() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BANK_SYNC_STORAGE, "1");
  window.dispatchEvent(new Event(BANK_SYNC_EVENT));
}

export function useBankSyncStatus() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const update = () => {
      setSynced(
        window.sessionStorage.getItem(BANK_SYNC_STORAGE) === "1" ||
          window.sessionStorage.getItem(LEGACY_SYNC_STORAGE) === "1",
      );
    };
    update();
    window.addEventListener(BANK_SYNC_EVENT, update);
    return () => window.removeEventListener(BANK_SYNC_EVENT, update);
  }, []);

  return synced;
}

export function useBankAutoSync({
  uid,
  connected,
  provider,
  preferredAccountId,
  profileLoading,
}: {
  uid?: string;
  connected: boolean;
  provider: BankProvider | null;
  preferredAccountId?: string | null;
  profileLoading: boolean;
}) {
  const startedForUid = useRef<string | null>(null);
  const syncing = useRef(false);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!uid || !connected || !provider || profileLoading) return;

    const runSync = () => {
      if (syncing.current) return;
      syncing.current = true;
      lastSyncAt.current = Date.now();
      void syncBankData(provider, { preferredAccountId })
        .then(() => markBankSyncComplete())
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
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (Date.now() - lastSyncAt.current < MIN_RESUME_SYNC_INTERVAL_MS) return;
      runSync();
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, [connected, preferredAccountId, profileLoading, provider, uid]);
}
