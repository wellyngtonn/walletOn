"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribeAllTransactions,
} from "@/services/transactions";
import type { Transaction } from "@/types";

const transactionsCache = new Map<string, Transaction[]>();

export function useAllTransactions() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const cached = transactionsCache.get(uid);
    setTransactions(cached || []);
    setLoading(!cached);
    setError("");
    return subscribeAllTransactions(
      uid,
      (items) => {
        transactionsCache.set(uid, items);
        setTransactions(items);
        setLoading(false);
      },
      (exception) => {
        setError(exception.message);
        setLoading(false);
      },
    );
  }, [uid]);

  return { transactions, loading, error };
}
