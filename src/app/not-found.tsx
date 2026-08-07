import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="widget max-w-sm p-10 text-center">
        <h1 className="mb-2 text-6xl font-extrabold text-[var(--accent)]">
          404
        </h1>
        <p className="mb-6 text-lg text-[var(--text3)]">
          Página não encontrada
        </p>
        <Link href="/resumo" className="btn-primary inline-flex">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
