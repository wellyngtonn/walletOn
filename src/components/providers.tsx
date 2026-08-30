"use client";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase/config";
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initAnalytics();
    window.localStorage.removeItem("wallet-pierre-api-key");
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
