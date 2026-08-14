"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  completeGoogleRedirect,
  signInEmail,
  signInGoogle,
} from "@/services/auth";

export default function Login() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/resumo");
  }, [user, router]);

  useEffect(() => {
    void completeGoogleRedirect().catch((err) => {
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      const message = err instanceof Error ? err.message : "Erro ao entrar com Google.";
      setError(
        code === "auth/unauthorized-domain"
          ? "Este domínio ainda não está autorizado no Firebase Authentication."
          : message.replace("Firebase: ", ""),
      );
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInEmail(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível entrar.";
      setError(message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  function enterWithGoogle() {
    void signInGoogle().catch((err) => {
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      const message =
        code === "auth/unauthorized-domain"
          ? "Este domínio ainda não está autorizado no Firebase Authentication."
          : err instanceof Error
            ? err.message.replace("Firebase: ", "")
            : "Erro ao entrar com Google.";
      setError(message);
    });
  }

  return (
    <main className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-[380px] px-6 py-8">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-[2rem] font-extrabold tracking-[-0.5px] text-[var(--text)]">
            Acesse sua conta
          </h1>
          <p className="text-[0.95rem] font-medium text-[var(--text3)]">
            Organize suas finanças com clareza.
          </p>
        </header>

        <form className="mb-4 flex flex-col gap-3" onSubmit={submit}>
          <input
            className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-[0.95rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
          />
          <div className="relative">
            <input
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 pr-20 text-[0.95rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
              required
              minLength={6}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 6 caracteres"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-[0.3px] text-[var(--text3)]"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "OCULTAR" : "MOSTRAR"}
            </button>
          </div>
          {error && <div className="msg-error">{error}</div>}
          <button disabled={busy} className="btn-primary w-full justify-center py-3">
            {busy ? "Aguarde..." : "Entrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={enterWithGoogle}
          className="btn-outline w-full justify-center py-3"
        >
          Entrar com Google
        </button>
      </div>
    </main>
  );
}
