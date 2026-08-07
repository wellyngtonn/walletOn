"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user)
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg)]">
        <p className="animate-pulse text-lg font-bold text-[var(--text3)]">
          Carregando...
        </p>
      </div>
    );

  return children;
}
