"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribePlans,
  subscribeRecurrences,
} from "@/services/transactions";
import type { PlannedTransaction, Recurrence } from "@/types";

type PlanningCache = {
  plans: PlannedTransaction[];
  recurrences: Recurrence[];
};

const planningCache = new Map<string, PlanningCache>();

export function usePlanning() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [plans, setPlans] = useState<PlannedTransaction[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setPlans([]);
      setRecurrences([]);
      setLoading(false);
      return;
    }

    const cached = planningCache.get(uid);
    setPlans(cached?.plans || []);
    setRecurrences(cached?.recurrences || []);
    setLoading(!cached);
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
      uid,
      (items) => {
        planningCache.set(uid, {
          plans: items,
          recurrences: planningCache.get(uid)?.recurrences || [],
        });
        setPlans(items);
        plansLoaded = true;
        finishLoading();
      },
      onError,
    );
    const unsubscribeRecurrences = subscribeRecurrences(
      uid,
      (items) => {
        planningCache.set(uid, {
          plans: planningCache.get(uid)?.plans || [],
          recurrences: items,
        });
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
  }, [uid]);

  return { plans, recurrences, loading, error };
}
