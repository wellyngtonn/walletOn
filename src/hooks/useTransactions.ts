"use client";
import { useEffect, useState } from "react";
import type { Transaction } from "@/types";
import { subscribeTransactions } from "@/services/transactions";
export function useTransactions(
  uid: string | undefined,
  month: number,
  year: number,
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeTransactions(
      uid,
      month,
      year,
      (x) => {
        setTransactions(x);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [uid, month, year]);
  return { transactions, loading, error };
}
