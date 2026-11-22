"use client";

import { useEffect, useState } from "react";
import { subscribeBankProfile, type BankProfile } from "@/services/profile";

const emptyProfile: BankProfile = {
  provider: null,
  connected: false,
  pierreConnected: false,
  pluggyConnected: false,
  balance: null,
  accountId: null,
  accountName: null,
  accounts: [],
  itemId: null,
  itemStatus: null,
  connectorName: null,
};

export function useBankProfile(uid: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BankProfile>(emptyProfile);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile(emptyProfile);
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    return subscribeBankProfile(
      uid,
      (nextProfile) => {
        setProfile(nextProfile);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      },
    );
  }, [uid]);

  return { ...profile, error, loading };
}
