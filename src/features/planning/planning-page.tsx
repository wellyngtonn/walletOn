"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/components/app-shell";
import { usePlanning } from "@/hooks/usePlanning";
import {
  createPlan,
  createRecurrence,
  createTransaction,
  deletePlan,
  deleteRecurrence,
  updatePlan,
  updateRecurrence,
} from "@/services/transactions";
import type {
  PlanType,
  PlannedTransaction,
  Recurrence,
  RecurrenceInput,
  RecurrencePeriod,
  PlannedTransactionInput,
} from "@/types";
import { currency, dateBR } from "@/utils/format";
import {
  recurrenceDate,
  recurrenceExpired,
  recurrenceScheduled,
} from "@/utils/planning";

const CATEGORIES = [
  "Alimentação", "Assinaturas", "Beleza", "Combustível", "Compras",
  "Contas", "Educação", "Farmácia", "Investimento", "Lazer", "Moradia",
  "Pets", "Restaurantes", "Salário", "Saúde", "Serviços", "Supermercado",
  "Transferências", "Transporte", "Vestuário", "Viagem", "Outros",
];

const categoryIcon: Record<string, string> = {
  Alimentação: "🍱", Transporte: "🚗", Saúde: "💊", Educação: "📚",
  Lazer: "🎮", Moradia: "🏠", Salário: "💼", Investimento: "📈",
  Compras: "🛍️", Contas: "📄", Assinaturas: "📱", Pets: "🐾",
  Outros: "📊",
};

const emptyPlan = (date: string): PlannedTransactionInput => ({
  type: "expense",
  description: "",
  amount: 0,
  date,
  category: "Outros",
  paid: false,
});

const emptyRecurrence = (date: string): RecurrenceInput => ({
  type: "expense",
  description: "",
  amount: 0,
  startDate: date,
  originalDay: new Date(`${date}T12:00:00`).getDate(),
  category: "Outros",
  period: "monthly",
  paid: false,
});

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function periodLabel(period: RecurrencePeriod) {
  return period === "monthly" ? "Mensal" : period === "quarterly" ? "Trimestral" : "Anual";
}

export function PlanningPage() {
  const { user } = useAuth();
  const {
    month,
    year,
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useDashboard();
  const { plans, recurrences, loading, error } = usePlanning();
  const [modal, setModal] = useState<"plan" | "recurrence" | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannedTransaction | null>(null);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
  const [planForm, setPlanForm] = useState<PlannedTransactionInput>(emptyPlan(todayString()));
  const [recurrenceForm, setRecurrenceForm] = useState<RecurrenceInput>(emptyRecurrence(todayString()));
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const processing = useRef(false);

  const monthPlans = useMemo(
    () =>
      plans.filter((plan) => {
        const date = new Date(`${plan.date}T12:00:00`);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      }),
    [month, plans, year],
  );
  const scheduledRecurrences = useMemo(
    () => recurrences.filter((recurrence) => recurrenceScheduled(recurrence, year, month)),
    [month, recurrences, year],
  );
  const plannedExpenses = useMemo(
    () => [
      ...monthPlans.filter((plan) => plan.type === "expense").map((plan) => ({
        category: plan.category,
        amount: plan.amount,
      })),
      ...scheduledRecurrences
        .filter((recurrence) => recurrence.type === "expense")
        .map((recurrence) => ({ category: recurrence.category, amount: recurrence.amount })),
    ],
    [monthPlans, scheduledRecurrences],
  );
  const topCategories = useMemo(() => {
    const totals = new Map<string, number>();
    plannedExpenses.forEach((item) =>
      totals.set(item.category, (totals.get(item.category) || 0) + item.amount),
    );
    const total = plannedExpenses.reduce((sum, item) => sum + item.amount, 0);
    return Array.from(totals.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total ? (amount / total) * 100 : 0,
      }));
  }, [plannedExpenses]);

  const predictedIncome =
    monthPlans.filter((plan) => plan.type === "income").reduce((sum, plan) => sum + plan.amount, 0) +
    scheduledRecurrences
      .filter((recurrence) => recurrence.type === "income")
      .reduce((sum, recurrence) => sum + recurrence.amount, 0);
  const predictedExpenses =
    monthPlans.filter((plan) => plan.type === "expense").reduce((sum, plan) => sum + plan.amount, 0) +
    scheduledRecurrences
      .filter((recurrence) => recurrence.type === "expense")
      .reduce((sum, recurrence) => sum + recurrence.amount, 0);

  useEffect(() => {
    if (
      !user ||
      loading ||
      transactionsLoading ||
      transactionsError ||
      processing.current ||
      !recurrences.length
    ) return;
    const today = new Date();
    if (
      year * 12 + month - 1 >
      today.getFullYear() * 12 + today.getMonth()
    ) return;
    const missing = scheduledRecurrences.filter(
      (recurrence) =>
        !transactions.some(
          (transaction) =>
            transaction.recurrenceId === recurrence.id &&
            transaction.date === recurrenceDate(recurrence, year, month),
        ),
    );
    if (!missing.length) return;
    processing.current = true;
    Promise.all(
      missing.map((recurrence) => {
        const date = recurrenceDate(recurrence, year, month);
        return createTransaction(user.uid, {
          type: recurrence.type,
          description: recurrence.description,
          amount: recurrence.amount,
          date,
          referenceMonth: month,
          referenceYear: year,
          category: recurrence.category,
          recurrenceId: recurrence.id,
        });
      }),
    ).finally(() => {
      processing.current = false;
    });
  }, [loading, month, recurrences, scheduledRecurrences, transactions, transactionsError, transactionsLoading, user, year]);

  function openPlan(plan?: PlannedTransaction) {
    setActionError("");
    setEditingPlan(plan || null);
    setPlanForm(
      plan
        ? {
            type: plan.type,
            description: plan.description,
            amount: plan.amount,
            date: plan.date,
            category: plan.category,
            paid: plan.paid || false,
          }
        : emptyPlan(todayString()),
    );
    setModal("plan");
  }

  function openRecurrence(recurrence?: Recurrence) {
    setActionError("");
    setEditingRecurrence(recurrence || null);
    if (!recurrence) {
      setRecurrenceForm(emptyRecurrence(todayString()));
    } else {
      const form: RecurrenceInput = {
        type: recurrence.type,
        description: recurrence.description,
        amount: recurrence.amount,
        startDate: recurrence.startDate,
        originalDay: recurrence.originalDay,
        category: recurrence.category,
        period: recurrence.period,
        paid: recurrence.paid || false,
      };
      if (recurrence.limit) form.limit = recurrence.limit;
      setRecurrenceForm(form);
    }
    setModal("recurrence");
  }

  async function savePlan() {
    if (!user || !planForm.description.trim() || planForm.amount <= 0 || !planForm.date) {
      setActionError("Preencha descrição, valor e data.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      const data = { ...planForm, description: planForm.description.trim() };
      if (editingPlan) await updatePlan(user.uid, editingPlan.id, data);
      else await createPlan(user.uid, data);
      setModal(null);
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRecurrence() {
    if (!user || !recurrenceForm.description.trim() || recurrenceForm.amount <= 0 || !recurrenceForm.startDate) {
      setActionError("Preencha descrição, valor e início.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      const start = new Date(`${recurrenceForm.startDate}T12:00:00`);
      const { limit, ...recurrenceValues } = recurrenceForm;
      const data: RecurrenceInput = {
        ...recurrenceValues,
        description: recurrenceForm.description.trim(),
        originalDay: start.getDate(),
      };
      if (limit) data.limit = limit;
      if (editingRecurrence) await updateRecurrence(user.uid, editingRecurrence.id, data);
      else await createRecurrence(user.uid, data);
      setModal(null);
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePlan(plan: PlannedTransaction) {
    if (!user) return;
    await updatePlan(user.uid, plan.id, {
      type: plan.type,
      description: plan.description,
      amount: plan.amount,
      date: plan.date,
      category: plan.category,
      paid: !plan.paid,
    });
  }

  async function toggleRecurrence(recurrence: Recurrence) {
    if (!user) return;
    const data: RecurrenceInput = {
      type: recurrence.type,
      description: recurrence.description,
      amount: recurrence.amount,
      startDate: recurrence.startDate,
      originalDay: recurrence.originalDay,
      category: recurrence.category,
      period: recurrence.period,
      paid: !recurrence.paid,
    };
    if (recurrence.limit) data.limit = recurrence.limit;
    await updateRecurrence(user.uid, recurrence.id, data);
  }

  async function removePlan(plan: PlannedTransaction) {
    if (!user || !confirm("Excluir este lançamento planejado?")) return;
    await deletePlan(user.uid, plan.id);
  }

  async function removeRecurrence(recurrence: Recurrence) {
    if (!user || !confirm("Excluir esta recorrência?")) return;
    await deleteRecurrence(user.uid, recurrence.id);
  }

  if (loading) return <p className="text-[var(--text3)]">Carregando planejamento...</p>;
  if (error) return <div className="msg-error">{error}</div>;

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="sec-title">Planejamento</h2>
        <div className="plan-actions">
          <button className="btn-primary" onClick={() => openPlan()}>＋ Lançamento</button>
          <button className="btn-outline" onClick={() => openRecurrence()}>↻ Recorrência</button>
        </div>
      </div>

      <div className="plan-summary-grid">
        <div className="plan-summary-card plan-summary-income">
          <span>Previsto Entradas</span><strong>{currency(predictedIncome)}</strong>
        </div>
        <div className="plan-summary-card plan-summary-expense">
          <span>Previsto Saídas</span><strong>{currency(predictedExpenses)}</strong>
        </div>
        <div className="plan-summary-card plan-summary-balance">
          <span>Saldo Previsto</span><strong>{currency(predictedIncome - predictedExpenses)}</strong>
        </div>
      </div>

      <div className="widget planning-full-card">
        <div className="planning-widget-header"><h3 className="planning-widget-title">Top 3 Categorias (Gastos)</h3></div>
        {topCategories.length === 0 ? <p className="tx-empty">Sem despesas neste mês</p> : (
          <div className="top-plan-categories">
            {topCategories.map((item, index) => (
              <div className="top-plan-category" key={item.category}>
                <div className="top-plan-category-head">
                  <span>{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} {categoryIcon[item.category] || "📊"} {item.category}</span>
                  <strong>{currency(item.amount)}</strong>
                </div>
                <div className="top-plan-progress"><div style={{ width: `${item.percentage}%` }}><span>{Math.round(item.percentage)}%</span></div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="widget planning-full-card">
        <div className="planning-widget-header"><h3 className="planning-widget-title">Lançamentos Futuros</h3></div>
        {!monthPlans.length ? <p className="tx-empty">Nenhum lançamento planejado.</p> : (
          <div className="tx-list">
            {monthPlans.map((plan) => (
              <div className={`tx-item ${plan.paid ? "plan-item-paid" : ""}`} key={plan.id}>
                <div className={`tx-icon ${plan.type === "income" ? "in" : "out"}`}>{categoryIcon[plan.category] || "📊"}</div>
                <div className="tx-info"><span className="tx-desc">{plan.description}</span><span className="tx-meta">{plan.category} · {dateBR(plan.date)}</span></div>
                <span className={`tx-val ${plan.type === "income" ? "in" : "out"}`}>{plan.type === "income" ? "+" : "−"} {currency(plan.amount)}</span>
                <div className="planning-actions">
                  <button onClick={() => void togglePlan(plan)} title={plan.paid ? "Marcar como não pago" : "Marcar como pago"}>{plan.paid ? "✓" : "◯"}</button>
                  {!plan.paid && <button onClick={() => openPlan(plan)} title="Editar">✎</button>}
                  <button onClick={() => void removePlan(plan)} title="Excluir">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="widget planning-full-card">
        <div className="planning-widget-header"><h3 className="planning-widget-title">Recorrências Ativas</h3></div>
        {!recurrences.length ? <p className="tx-empty">Nenhuma recorrência cadastrada.</p> : (
          <div className="tx-list">
            {recurrences.map((recurrence) => {
              const expired = recurrenceExpired(recurrence, year, month);
              return (
                <div className={`tx-item ${expired ? "plan-item-expired" : ""} ${recurrence.paid ? "plan-item-paid" : ""}`} key={recurrence.id}>
                  <div className={`tx-icon ${recurrence.type === "income" ? "in" : "out"}`}>{categoryIcon[recurrence.category] || "📊"}</div>
                  <div className="tx-info"><span className="tx-desc">{recurrence.description}</span><span className="tx-meta">{recurrence.category} · {periodLabel(recurrence.period)}{expired ? " · expirada" : ""}</span></div>
                  <span className={`tx-val ${recurrence.type === "income" ? "in" : "out"}`}>{recurrence.type === "income" ? "+" : "−"} {currency(recurrence.amount)}</span>
                  <div className="planning-actions">
                    <button onClick={() => void toggleRecurrence(recurrence)} title={recurrence.paid ? "Marcar como não pago" : "Marcar como pago"}>{recurrence.paid ? "✓" : "◯"}</button>
                    {!recurrence.paid && <button onClick={() => openRecurrence(recurrence)} title="Editar">✎</button>}
                    <button onClick={() => void removeRecurrence(recurrence)} title="Excluir">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="pierre-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{modal === "plan" ? "Lançamento Futuro" : "Recorrência"}</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="type-tabs">
              {(["expense", "income"] as PlanType[]).map((type) => (
                <button key={type} className={`type-tab ${(modal === "plan" ? planForm.type : recurrenceForm.type) === type ? "active" : ""}`} onClick={() => modal === "plan" ? setPlanForm({ ...planForm, type }) : setRecurrenceForm({ ...recurrenceForm, type })}>
                  {type === "expense" ? "Despesa" : "Receita"}
                </button>
              ))}
            </div>
            <div className="modal-body">
              <input className="field" value={modal === "plan" ? planForm.description : recurrenceForm.description} onChange={(event) => modal === "plan" ? setPlanForm({ ...planForm, description: event.target.value }) : setRecurrenceForm({ ...recurrenceForm, description: event.target.value })} placeholder="Descrição" />
              <input className="field" type="number" min="0.01" step="0.01" value={(modal === "plan" ? planForm.amount : recurrenceForm.amount) || ""} onChange={(event) => modal === "plan" ? setPlanForm({ ...planForm, amount: Number(event.target.value) }) : setRecurrenceForm({ ...recurrenceForm, amount: Number(event.target.value) })} placeholder="Valor (R$)" />
              {modal === "plan" ? (
                <input className="field" type="date" value={planForm.date} onChange={(event) => setPlanForm({ ...planForm, date: event.target.value })} />
              ) : (
                <>
                  <input className="field" type="date" value={recurrenceForm.startDate} onChange={(event) => setRecurrenceForm({ ...recurrenceForm, startDate: event.target.value })} />
                  <select className="field" value={recurrenceForm.period} onChange={(event) => setRecurrenceForm({ ...recurrenceForm, period: event.target.value as RecurrencePeriod })}>
                    <option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option>
                  </select>
                  <input className="field" type="number" min="1" value={recurrenceForm.limit || ""} onChange={(event) => setRecurrenceForm({ ...recurrenceForm, limit: event.target.value ? Number(event.target.value) : undefined })} placeholder="Repetições (vazio = sem limite)" />
                </>
              )}
              <select className="field" value={modal === "plan" ? planForm.category : recurrenceForm.category} onChange={(event) => modal === "plan" ? setPlanForm({ ...planForm, category: event.target.value }) : setRecurrenceForm({ ...recurrenceForm, category: event.target.value })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              {actionError && <div className="msg-error">{actionError}</div>}
            </div>
            <div className="modal-footer"><button className="btn-outline" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={() => void (modal === "plan" ? savePlan() : saveRecurrence())} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
