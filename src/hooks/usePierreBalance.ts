"use client";

import { useEffect, useState } from "react";
import {
  subscribePierreProfile,
  type PierreProfile,
} from "@/services/profile";

export function usePierreBalance(uid: string | undefined) {
  const [profile, setProfile] = useState<PierreProfile>({
    balance: null,
    accountId: null,
    accountName: null,
    accounts: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setProfile({ balance: null, accountId: null, accountName: null, accounts: [] });
      return;
    }

    setError("");
    return subscribePierreProfile(
      uid,
      setProfile,
      (snapshotError) => setError(snapshotError.message),
    );
  }, [uid]);

  return { ...profile, error };
}
