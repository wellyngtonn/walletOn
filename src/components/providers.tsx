"use client";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase/config";
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initAnalytics();
    window.localStorage.removeItem("wallet-pierre-api-key");
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker.register("/sw.js");
      } else {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => void r.unregister()));
      }
    }
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
