"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeShoppingHistory, subscribeShoppingItems } from "@/services/shopping";
import type { ShoppingHistory, ShoppingItem } from "@/types";

const shoppingCache = new Map<string, ShoppingItem[]>();
const shoppingHistoryCache = new Map<string, ShoppingHistory[]>();

export function useShoppingList() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [history, setHistory] = useState<ShoppingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    const cached = shoppingCache.get(uid);
    const cachedHistory = shoppingHistoryCache.get(uid);
    setItems(cached || []);
    setHistory(cachedHistory || []);
    setLoading(!cached || !cachedHistory);
    setError("");
    const unsubscribeItems = subscribeShoppingItems(
      uid,
      (nextItems) => {
        shoppingCache.set(uid, nextItems);
        setItems(nextItems);
        setLoading(false);
      },
      (exception) => {
        setError(exception.message);
        setLoading(false);
      },
    );
    const unsubscribeHistory = subscribeShoppingHistory(
      uid,
      (nextHistory) => {
        shoppingHistoryCache.set(uid, nextHistory);
        setHistory(nextHistory);
        setLoading(false);
      },
      (exception) => {
        setError(exception.message);
        setLoading(false);
      },
    );
    return () => {
      unsubscribeItems();
      unsubscribeHistory();
    };
  }, [uid]);

  return { items, history, loading, error };
}
