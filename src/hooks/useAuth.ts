"use client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/config";
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(
        auth,
        (u) => {
          setUser(u);
          setLoading(false);
        },
        (error) => {
          console.error("Falha ao observar a sessão", error);
          setLoading(false);
        },
      ),
    [],
  );
  return { user, loading };
}
