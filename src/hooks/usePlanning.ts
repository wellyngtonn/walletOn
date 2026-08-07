"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribePlans,
  subscribeRecurrences,
} from "@/services/transactions";
import type { PlannedTransaction, Recurrence } from "@/types";

export function usePlanning() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlannedTransaction[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setPlans([]);
      setRecurrences([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    let plansLoaded = false;
    let recurrencesLoaded = false;
    const finishLoading = () => {
      if (plansLoaded && recurrencesLoaded) setLoading(false);
    };
    const onError = (exception: Error) => {
      setError(exception.message);
      setLoading(false);
    };
    const unsubscribePlans = subscribePlans(
      user.uid,
      (items) => {
        setPlans(items);
        plansLoaded = true;
        finishLoading();
      },
      onError,
    );
    const unsubscribeRecurrences = subscribeRecurrences(
      user.uid,
      (items) => {
        setRecurrences(items);
        recurrencesLoaded = true;
        finishLoading();
      },
      onError,
    );
    return () => {
      unsubscribePlans();
      unsubscribeRecurrences();
    };
  }, [user]);

  return { plans, recurrences, loading, error };
}
