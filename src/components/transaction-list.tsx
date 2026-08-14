"use client";
import { useAuth } from "@/hooks/useAuth";
import { deleteTransaction } from "@/services/transactions";
import type { Transaction, TransactionType } from "@/types";
import { currency, dateBR } from "@/utils/format";
import { pierreCategoryIcon } from "@/utils/pierre-category";

const labels: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  investment: "Investimento",
};

export function TransactionList({
  items,
  onEdit,
  showActions = true,
}: {
  items: Transaction[];
  onEdit: (t: Transaction) => void;
  showActions?: boolean;
}) {
  const { user } = useAuth();

  async function remove(id: string) {
    if (user && confirm("Excluir este lançamento?"))
      await deleteTransaction(user.uid, id);
  }

  if (!items.length)
    return (
      <p className="tx-empty">
        Nenhum lançamento neste período.
      </p>
    );

  return (
    <div className="tx-list">
      {items.map((t) => (
        <div key={t.id} className="tx-item">
          <div
            className={`tx-icon ${t.type === "income" ? "in" : "out"}`}
            title={t.category || "Outros"}
            aria-label={`Categoria: ${t.category || "Outros"}`}
          >
            {pierreCategoryIcon(t.category, t.description, t.type)}
          </div>
          <div className="tx-info">
            <p className="tx-desc">{t.description}</p>
            <p className="tx-meta">
              {labels[t.type]} · {dateBR(t.date)}
            </p>
          </div>
          <p className={`tx-val ${t.type === "income" ? "in" : "out"}`}>
            {t.type === "income" ? "+" : "−"} {currency(t.amount)}
          </p>
          {showActions && (
            <div className="tx-actions">
              <button onClick={() => onEdit(t)} className="tx-action-btn">
                Editar
              </button>
              <button
                onClick={() => void remove(t.id)}
                className="tx-action-btn danger"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
