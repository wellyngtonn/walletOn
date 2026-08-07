"use client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/services/auth";

const links = [
  { href: "/resumo", label: "Painel" },
  { href: "/analise", label: "Análise Mensal" },
  { href: "/planejamento", label: "Plano" },
  { href: "/configuracoes", label: "Configurações" },
];

export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = user?.displayName?.charAt(0) || user?.email?.charAt(0) || "?";
  const name = user?.displayName || user?.email || "Usuário";

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-[var(--card)] p-2 shadow"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        <Menu size={22} />
      </button>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/45"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className="fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="mb-6 flex items-center gap-3 rounded-[14px] bg-[var(--bg)] p-3">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.95rem] font-bold text-white">
            {initial.toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-[0.88rem] font-bold text-[var(--text)]">
              {name}
            </span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ href, label }) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              className="rounded-[12px] px-3.5 py-[11px] text-[0.9rem] font-semibold text-[var(--text2)] transition-all duration-[180ms] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              style={
                path === href
                  ? {
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                    }
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[var(--card-border)] pt-4">
          <button
            onClick={() => void logout()}
            className="w-full rounded-[12px] px-3.5 py-[11px] text-left text-[0.9rem] font-semibold text-[var(--red)] transition-all duration-[180ms] hover:bg-[var(--red-bg)]"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
