"use client";

import { useDashboard } from "@/components/app-shell";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { MonthlyAnalysis } from "@/features/analysis/monthly-analysis";

export default function Page() {
  const { month, year, openEdit } = useDashboard();
  const { transactions, loading, error } = useAllTransactions();

  if (loading) return <p className="text-[var(--text3)]">Carregando análise...</p>;
  if (error) return <div className="msg-error">{error}</div>;

  return (
    <MonthlyAnalysis
      items={transactions}
      allItems={transactions}
      month={month}
      year={year}
      onEdit={openEdit}
    />
  );
}
