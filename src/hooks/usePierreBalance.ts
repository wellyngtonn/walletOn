"use client";

import { useEffect, useState } from "react";
import {
  subscribePierreProfile,
  type PierreProfile,
} from "@/services/profile";

export function usePierreBalance(uid: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PierreProfile>({
    balance: null,
    accountId: null,
    accountName: null,
    accounts: [],
    apiKey: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setProfile({ balance: null, accountId: null, accountName: null, accounts: [], apiKey: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    return subscribePierreProfile(
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
