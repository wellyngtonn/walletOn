"use client";
import { useDashboard } from "@/components/app-shell";
import { Summary } from "@/features/dashboard/summary";

export default function Page() {
  const {
    transactions,
    loading,
    error,
    month,
    year,
    pierreBalance,
    pierreAccountId,
    pierreAccountName,
    openEdit,
  } = useDashboard();
  if (loading) return <p className="text-[var(--text3)]">Carregando dados...</p>;
  return (
    <>
      {error && <div className="msg-error mb-4">{error}</div>}
      <Summary
        items={transactions}
        month={month}
        year={year}
        pierreBalance={pierreBalance}
        pierreAccountId={pierreAccountId}
        pierreAccountName={pierreAccountName}
        onEdit={openEdit}
      />
    </>
  );
}
