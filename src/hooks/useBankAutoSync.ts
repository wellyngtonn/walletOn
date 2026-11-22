"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { syncBankData } from "@/services/bank";
import type { BankProvider } from "@/utils/bank";

const BANK_SYNC_EVENT = "wallet-bank-sync-complete";
const BANK_SYNC_STORAGE = "wallet-bank-sync-complete";
const MIN_RESUME_SYNC_INTERVAL_MS = 60_000;

function syncStorageKey(uid?: string | null) {
  return uid ? `${BANK_SYNC_STORAGE}:${uid}` : "";
}

export function markBankSyncComplete(uid?: string) {
  if (typeof window === "undefined") return;
  const key = syncStorageKey(uid || auth.currentUser?.uid);
  if (!key) return;
  window.sessionStorage.setItem(key, "1");
  window.dispatchEvent(new Event(BANK_SYNC_EVENT));
}

export function useBankSyncStatus(uid?: string) {
  const { user } = useAuth();
  const activeUid = uid || user?.uid;
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const key = syncStorageKey(activeUid);
    const update = () => {
      setSynced(Boolean(key && window.sessionStorage.getItem(key) === "1"));
    };
    update();
    window.addEventListener(BANK_SYNC_EVENT, update);
    return () => window.removeEventListener(BANK_SYNC_EVENT, update);
  }, [activeUid]);

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
  const startedFor = useRef<string | null>(null);
  const syncing = useRef(false);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!connected || !provider) {
      startedFor.current = null;
    }
    if (!uid || !connected || !provider || profileLoading) return;
    const syncKey = `${uid}:${provider}`;

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

    if (startedFor.current !== syncKey) {
      startedFor.current = syncKey;
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
