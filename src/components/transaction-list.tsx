"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { deleteTransaction } from "@/services/transactions";
import type { Transaction } from "@/types";
import { currency, dateBR, typeLabels } from "@/utils/format";
import { friendlyError } from "@/utils/errors";
import { categoryIcon } from "@/utils/pierre-category";
import { cleanTransactionName } from "@/utils/transaction-name";
import { displayCategory } from "@/utils/transaction-category";

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
  const [error, setError] = useState("");

  async function remove(id: string) {
    if (!user || !confirm("Excluir este lançamento?")) return;
    try {
      await deleteTransaction(user.uid, id);
    } catch (exception) {
      setError(friendlyError(exception, "Não foi possível excluir o lançamento."));
    }
  }

  if (!items.length)
    return (
      <p className="tx-empty">
        Nenhum lançamento neste período.
      </p>
    );

  return (
    <>
      {error && <div className="msg-error mb-2">{error}</div>}
      <div className="tx-list">
      {items.map((t) => {
        const category = displayCategory(t.category);
        return (
        <div key={t.id} className="tx-item">
          <div
            className={`tx-icon ${t.type === "income" ? "in" : "out"}`}
            title={category}
            aria-label={`Categoria: ${category}`}
          >
            {categoryIcon(category, t.description, t.type)}
          </div>
          <div className="tx-info">
            <p className="tx-desc">{cleanTransactionName(t.description)}</p>
            <p className="tx-meta">
              {typeLabels[t.type]} · {dateBR(t.date)}
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
        );
      })}
      </div>
    </>
  );
}
