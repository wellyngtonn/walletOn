"use client";

import { useEffect, useState } from "react";
import { subscribePierreBalance } from "@/services/profile";

export function usePierreBalance(uid: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setBalance(null);
      return;
    }

    setError("");
    return subscribePierreBalance(
      uid,
      setBalance,
      (snapshotError) => setError(snapshotError.message),
    );
  }, [uid]);

  return { balance, error };
}
