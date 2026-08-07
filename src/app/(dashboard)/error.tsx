"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="widget max-w-sm p-8 text-center">
        <h2 className="mb-2 text-xl font-extrabold text-[var(--text)]">
          Algo deu errado
        </h2>
        <p className="mb-5 text-[var(--text3)]">{error.message}</p>
        <button onClick={reset} className="btn-primary">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
