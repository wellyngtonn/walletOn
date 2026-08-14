"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createTransaction, updateTransaction } from "@/services/transactions";
import type { Transaction, TransactionInput, TransactionType } from "@/types";

export function TransactionModal({
  open,
  transaction,
  month,
  year,
  onClose,
}: {
  open: boolean;
  transaction: Transaction | null;
  month: number;
  year: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TransactionInput>({
    type: "expense",
    description: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    referenceMonth: month,
    referenceYear: year,
  });

  useEffect(() => {
    if (open)
      setForm(
        transaction
          ? {
              type: transaction.type,
              description: transaction.description,
              amount: transaction.amount,
              date: transaction.date,
              referenceMonth: transaction.referenceMonth,
              referenceYear: transaction.referenceYear,
            }
          : {
              type: "expense",
              description: "",
              amount: 0,
              date: new Date().toISOString().slice(0, 10),
              referenceMonth: month,
              referenceYear: year,
            },
      );
  }, [open, transaction, month, year]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      if (transaction) await updateTransaction(user.uid, transaction.id, form);
      else await createTransaction(user.uid, form);
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
