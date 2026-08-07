"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribeAllTransactions,
} from "@/services/transactions";
import type { Transaction } from "@/types";

export function useAllTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    return subscribeAllTransactions(
      user.uid,
      (items) => {
        setTransactions(items);
        setLoading(false);
      },
      (exception) => {
        setError(exception.message);
        setLoading(false);
      },
    );
  }, [user]);

  return { transactions, loading, error };
}
