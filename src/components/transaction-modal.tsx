"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createTransaction, updateTransaction } from "@/services/transactions";
import type { Transaction, TransactionInput, TransactionType } from "@/types";
import { CATEGORY_LABELS } from "@/utils/categories";
import { cleanTransactionName } from "@/utils/transaction-name";
import { displayCategory } from "@/utils/transaction-category";
import { todayISO } from "@/utils/format";

export function TransactionModal({
  open,
  transaction,
  initialType = "expense",
  month,
  year,
  onClose,
}: {
  open: boolean;
  transaction: Transaction | null;
  initialType?: TransactionType;
  month: number;
  year: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TransactionInput>({
    type: initialType,
    description: "",
    amount: 0,
    date: todayISO(),
    referenceMonth: month,
    referenceYear: year,
    category: "Outros",
  });

  useEffect(() => {
    if (open)
      setForm(
        transaction
          ? {
              type: transaction.type,
              description: cleanTransactionName(transaction.description),
              amount: transaction.amount,
              date: transaction.date,
              referenceMonth: transaction.referenceMonth,
              referenceYear: transaction.referenceYear,
              category: displayCategory(transaction.category),
            }
          : {
              type: initialType,
              description: "",
              amount: 0,
              date: todayISO(),
              referenceMonth: month,
              referenceYear: year,
              category: "Outros",
            },
      );
  }, [open, transaction, initialType, month, year]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const categoryChanged =
        transaction &&
        form.category !== displayCategory(transaction.category);
      const payload: TransactionInput = categoryChanged
        ? { ...form, categorySource: "manual" }
        : form;
      if (transaction) await updateTransaction(user.uid, transaction.id, payload);
      else await createTransaction(user.uid, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const types: { key: TransactionType; label: string }[] = [
    { key: "income", label: "Receita" },
    { key: "expense", label: "Despesa" },
    { key: "investment", label: "Investimento" },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="pierre-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {transaction ? "Editar" : "Novo"} lançamento
          </h2>
          <button onClick={onClose} className="modal-close">
            ✕
          </button>
        </div>

        <div className="type-tabs">
          {types.map((t) => (
            <button
              key={t.key}
              className={`type-tab ${form.type === t.key ? "active" : ""}`}
              onClick={() => setForm({ ...form, type: t.key })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="modal-body">
            <input
              required
              maxLength={120}
              className="field"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Descrição (ex.: Supermercado)"
            />
            <select
              className="field"
              aria-label="Categoria"
              value={form.category || "Outros"}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
            >
              {CATEGORY_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <div className="transaction-date-row">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                className="field"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm({ ...form, amount: +e.target.value })
                }
                placeholder="Valor"
              />
              <input
                required
                type="date"
                className="field"
                value={form.date}
                onChange={(e) => {
                  const d = new Date(`${e.target.value}T12:00:00`);
                  setForm({
                    ...form,
                    date: e.target.value,
                    referenceMonth: d.getMonth() + 1,
                    referenceYear: d.getFullYear(),
                  });
                }}
              />
            </div>
            {error && <div className="msg-error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
