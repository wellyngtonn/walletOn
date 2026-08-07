"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  registerEmail,
  resetPassword,
  signInEmail,
  signInGoogle,
} from "@/services/auth";

type Mode = "login" | "register" | "reset";

export default function Login() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/resumo");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "reset") {
        await resetPassword(email);
        setMessage("Enviamos o link de recuperação para seu e-mail.");
      } else if (mode === "register") {
        await registerEmail(name, email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Não foi possível continuar.";
      setError(text.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-[380px] px-6 py-8">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-[2rem] font-extrabold tracking-[-0.5px] text-[var(--text)]">
            {mode === "login"
              ? "Acesse sua conta"
              : mode === "register"
                ? "Crie sua conta"
                : "Recupere sua senha"}
          </h1>
          <p className="text-[0.95rem] font-medium text-[var(--text3)]">
            {mode === "reset"
              ? "Informe seu e-mail para receber o link."
              : "Organize suas finanças com clareza."}
          </p>
        </header>

        <form className="mb-5 flex flex-col gap-3" onSubmit={submit}>
          {mode === "register" && (
            <input
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-[0.95rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          )}
          <input
            className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-[0.95rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
          {mode !== "reset" && (
            <div className="relative">
              <input
                className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 pr-20 text-[0.95rem] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text3)] focus:border-[var(--accent)]"
                required
                minLength={6}
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-[0.3px] text-[var(--text3)]"
                onClick={() => setShow(!show)}
              >
                {show ? "OCULTAR" : "MOSTRAR"}
              </button>
            </div>
          )}
          {error && <div className="msg-error">{error}</div>}
          {message && <div className="msg-success">{message}</div>}
          <button disabled={busy} className="btn-primary w-full justify-center py-3">
            {busy
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Criar conta"
                  : "Enviar link"}
          </button>
        </form>

        {mode === "login" && (
          <>
            <button
              onClick={() =>
                void signInGoogle().catch((e) => {
                  const msg =
                    e instanceof Error
                      ? e.message.replace("Firebase: ", "")
                      : "Erro ao entrar com Google.";
                  setError(msg);
                })
              }
              className="btn-outline w-full justify-center py-3"
            >
              Continuar com Google
            </button>
            <button
              onClick={() => setMode("reset")}
              className="mt-4 w-full text-center text-sm font-semibold text-[var(--accent)]"
            >
              Esqueci minha senha
            </button>
            <p className="mt-6 text-center text-sm text-[var(--text2)]">
              Ainda não tem conta?{" "}
              <button
                onClick={() => setMode("register")}
                className="font-bold text-[var(--accent)]"
              >
                Cadastre-se
              </button>
            </p>
          </>
        )}

        {mode !== "login" && (
          <button
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            className="mt-4 w-full text-center text-sm font-bold text-[var(--accent)]"
          >
            Voltar para o login
          </button>
        )}
      </div>
    </main>
  );
}
