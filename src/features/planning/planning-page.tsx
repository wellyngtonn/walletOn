"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useDashboard } from "@/components/app-shell";
import { usePlanning } from "@/hooks/usePlanning";
import {
  createPlan,
  createRecurrence,
  createTransactionWithId,
  deletePlan,
  deleteRecurrence,
  deleteTransactionsByRecurrence,
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
import { currency, dateBR, todayISO } from "@/utils/format";
import { CATEGORY_LABELS } from "@/utils/categories";
import { friendlyError } from "@/utils/errors";
import {
  getDescriptionSuggestions,
  recurrenceDate,
  recurrenceExpired,
  recurrenceMonthKey,
  recurrencePaid,
  recurrenceScheduled,
  recurrenceStarted,
} from "@/utils/planning";

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

function periodLabel(period: RecurrencePeriod) {
  return period === "monthly" ? "Mensal" : period === "quarterly" ? "Trimestral" : "Anual";
}

const MAX_DRAG = 96;
const SWIPE_THRESHOLD = 60;

// Arrastar a linha para a direita desloca o cartão, revela "✎ Editar" e
// dispara a edição no lugar do botão ✎.
function SwipeToEditRow({
  className,
  disabled = false,
  onSwipe,
  children,
}: {
  className?: string;
  disabled?: boolean;
  onSwipe: () => void;
  children: ReactNode;
}) {
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="plan-swipe"
      style={{ touchAction: "pan-y", userSelect: "none" }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (
          event.target instanceof Element &&
          event.target.closest("button, a, input, select, textarea, [role='button']")
        ) {
          return;
        }
        dragStart.current = { x: event.clientX, y: event.clientY };
        suppressClick.current = false;
        setDragging(true);
        setDx(0);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Captura opcional; o gesto segue funcionando sem ela.
        }
      }}
      onPointerMove={(event) => {
        const start = dragStart.current;
        if (!start || disabled) return;
        const rawX = event.clientX - start.x;
        const rawY = event.clientY - start.y;
        if (Math.abs(rawX) <= Math.abs(rawY)) return;
        if (Math.abs(rawX) > 8) suppressClick.current = true;
        setDx(Math.max(0, Math.min(MAX_DRAG, rawX)));
      }}
      onPointerUp={(event) => {
        const start = dragStart.current;
        dragStart.current = null;
        setDragging(false);
        setDx(0);
        try {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Sem captura ativa.
        }
        if (!start) return;
        const rawX = event.clientX - start.x;
        const rawY = event.clientY - start.y;
        if (
          !disabled &&
          rawX >= SWIPE_THRESHOLD &&
          Math.abs(rawX) > Math.abs(rawY) * 1.15
        ) {
          suppressClick.current = true;
          onSwipe();
        }
      }}
      onPointerCancel={(event) => {
        dragStart.current = null;
        setDragging(false);
        setDx(0);
        try {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Sem captura ativa.
        }
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
    >
      <div
        className="plan-swipe-action"
        aria-hidden="true"
        style={{
          width: disabled ? 0 : dx,
          transition: dragging ? "none" : "width 200ms ease",
        }}
      >
        ✎ Editar
      </div>
      <div
        className={className}
        style={{
          transform: dx > 0 && !disabled ? `translateX(${dx}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
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
  const { transactions: historicalTransactions } = useAllTransactions();
  const [modal, setModal] = useState<"plan" | "recurrence" | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlannedTransaction | null>(null);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
  const [planForm, setPlanForm] = useState<PlannedTransactionInput>(emptyPlan(todayISO()));
  const [recurrenceForm, setRecurrenceForm] = useState<RecurrenceInput>(emptyRecurrence(todayISO()));
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Recurrence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const processing = useRef(false);

  const description = modal === "plan" ? planForm.description : recurrenceForm.description;
  const descriptionSuggestions = useMemo(
    () =>
      getDescriptionSuggestions(
        [
          ...historicalTransactions.map((transaction) => transaction.description),
          ...plans.map((plan) => plan.description),
          ...recurrences.map((recurrence) => recurrence.description),
        ],
        description,
      ),
    [description, historicalTransactions, plans, recurrences],
  );

  const monthPlans = useMemo(
    () =>
      plans
        .filter((plan) => {
          const date = new Date(`${plan.date}T12:00:00`);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        })
        .sort(
          (a, b) =>
            Number(a.paid || false) - Number(b.paid || false),
        ),
    [month, plans, year],
  );
  const scheduledRecurrences = useMemo(
    () => recurrences.filter((recurrence) => recurrenceScheduled(recurrence, year, month)),
    [month, recurrences, year],
  );
  const startedRecurrences = useMemo(
    () =>
      recurrences
        .filter((recurrence) => recurrenceStarted(recurrence, year, month))
        .sort(
          (a, b) =>
            Number(recurrencePaid(a, year, month)) -
            Number(recurrencePaid(b, year, month)),
        ),
    [month, recurrences, year],
  );
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
  const pendingExpenses =
    monthPlans.filter((plan) => plan.type === "expense" && !plan.paid).reduce((sum, plan) => sum + plan.amount, 0) +
    scheduledRecurrences
      .filter((recurrence) => recurrence.type === "expense" && !recurrencePaid(recurrence, year, month))
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
        const id = `rec-${recurrence.id}-${year}-${String(month).padStart(2, "0")}`;
        return createTransactionWithId(user.uid, id, {
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
    )
      .catch((exception) => {
        setActionError(
          friendlyError(exception, "Não foi possível lançar a recorrência."),
        );
      })
      .finally(() => {
        processing.current = false;
      });
  }, [loading, month, recurrences, scheduledRecurrences, transactions, transactionsError, transactionsLoading, user, year]);

  function openPlan(plan?: PlannedTransaction) {
    setActionError("");
    setDescriptionFocused(false);
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
        : emptyPlan(todayISO()),
    );
    setModal("plan");
  }

  function openRecurrence(recurrence?: Recurrence) {
    setActionError("");
    setDescriptionFocused(false);
    setEditingRecurrence(recurrence || null);
    if (!recurrence) {
      setRecurrenceForm(emptyRecurrence(todayISO()));
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

  function updateDescription(value: string) {
    if (modal === "plan") setPlanForm({ ...planForm, description: value });
    else setRecurrenceForm({ ...recurrenceForm, description: value });
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
      setActionError(friendlyError(exception, "Não foi possível salvar."));
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
      setActionError(friendlyError(exception, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePlan(plan: PlannedTransaction) {
    if (!user) return;
    try {
      await updatePlan(user.uid, plan.id, {
        type: plan.type,
        description: plan.description,
        amount: plan.amount,
        date: plan.date,
        category: plan.category,
        paid: !plan.paid,
      });
    } catch (exception) {
      setActionError(friendlyError(exception, "Não foi possível atualizar o lançamento."));
    }
  }

  async function toggleRecurrence(recurrence: Recurrence) {
    if (!user) return;
    const monthKey = recurrenceMonthKey(year, month);
    const paidMonths = { ...(recurrence.paidMonths || {}) };
    if (paidMonths[monthKey]) delete paidMonths[monthKey];
    else paidMonths[monthKey] = true;
    const data: RecurrenceInput = {
      type: recurrence.type,
      description: recurrence.description,
      amount: recurrence.amount,
      startDate: recurrence.startDate,
      originalDay: recurrence.originalDay,
      category: recurrence.category,
      period: recurrence.period,
      paidMonths,
    };
    if (recurrence.limit) data.limit = recurrence.limit;
    try {
      await updateRecurrence(user.uid, recurrence.id, data);
    } catch (exception) {
      setActionError(friendlyError(exception, "Não foi possível atualizar a recorrência."));
    }
  }

  async function removePlan(plan: PlannedTransaction) {
    if (!user || !confirm("Excluir este lançamento planejado?")) return;
    try {
      await deletePlan(user.uid, plan.id);
    } catch (exception) {
      setActionError(friendlyError(exception, "Não foi possível excluir o lançamento."));
    }
  }

  function requestRemoveRecurrence(recurrence: Recurrence) {
    setActionError("");
    setDeleteTarget(recurrence);
  }

  async function confirmRemoveRecurrence(alsoDeleteTransactions: boolean) {
    if (!user || !deleteTarget || deleting) return;
    setDeleting(true);
    setActionError("");
    try {
      await deleteRecurrence(user.uid, deleteTarget.id);
      if (alsoDeleteTransactions) {
        await deleteTransactionsByRecurrence(user.uid, deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (exception) {
      setActionError(friendlyError(exception, "Não foi possível excluir a recorrência."));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-[var(--text3)]">Carregando planejamento...</p>;
  if (error) return <div className="msg-error">{error}</div>;

  return (
    <>
      <div className="mb-5 flex flex-col items-start gap-3">
        <h2 className="sec-title">Planejamento</h2>
        <div className="plan-actions">
          <button className="btn-primary" onClick={() => openPlan()}>＋ Lançamento</button>
          <button className="btn-outline" onClick={() => openRecurrence()}>↻ Recorrência</button>
        </div>
      </div>

      <div className="plan-summary-grid">
        <div className="plan-summary-card">
          <div className="plan-summary-metric plan-summary-income">
            <span>Previsto Entradas</span>
            <strong>{currency(predictedIncome)}</strong>
          </div>
          <div className="plan-summary-metric plan-summary-expense">
            <span>Previsto Saídas</span>
            <strong>{currency(predictedExpenses)}</strong>
          </div>
          <div className="plan-summary-metric plan-summary-balance">
            <span>Saldo Previsto</span>
            <strong>{currency(predictedIncome - predictedExpenses)}</strong>
          </div>
          <div className="plan-summary-metric plan-summary-expense">
            <span>Pendente Saídas</span>
            <strong>{currency(pendingExpenses)}</strong>
          </div>
        </div>
      </div>

      <div className="widget planning-full-card">
        <div className="planning-widget-header"><h3 className="planning-widget-title">Lançamentos Futuros</h3></div>
        {!monthPlans.length ? <p className="tx-empty">Nenhum lançamento planejado.</p> : (
          <div className="tx-list plan-compact-list">
            {monthPlans.map((plan) => (
              <SwipeToEditRow
                className={`tx-item${plan.paid ? " plan-item-paid" : ""}`}
                key={plan.id}
                onSwipe={() => openPlan(plan)}
              >
                <button
                  className="plan-check"
                  type="button"
                  onClick={() => void togglePlan(plan)}
                  title={plan.paid ? "Marcar como não pago" : "Marcar como pago"}
                  aria-label={`${plan.description}: ${plan.paid ? "marcar como não pago" : "marcar como pago"}`}
                  aria-pressed={plan.paid || false}
                >
                  {plan.paid ? "✓" : "◯"}
                </button>
                <div className="tx-info">
                  <span className="tx-desc">{plan.description}</span>
                  <span className="plan-badge">{plan.category}</span>
                  <span className="plan-meta">{dateBR(plan.date)}</span>
                </div>
                <span className={`tx-val ${plan.type === "income" ? "in" : "out"}`}>{plan.type === "income" ? "+" : "−"} {currency(plan.amount)}</span>
                <div className="planning-actions">
                  <button type="button" onClick={() => void removePlan(plan)} title="Excluir" aria-label={`Excluir ${plan.description}`}>×</button>
                </div>
              </SwipeToEditRow>
            ))}
          </div>
        )}
      </div>

      <div className="widget planning-full-card">
        <div className="planning-widget-header"><h3 className="planning-widget-title">Recorrências Ativas</h3></div>
        {!startedRecurrences.length ? <p className="tx-empty">Nenhuma recorrência iniciada neste mês.</p> : (
          <div className="tx-list plan-compact-list">
            {startedRecurrences.map((recurrence) => {
              const expired = recurrenceExpired(recurrence, year, month);
              const paid = recurrencePaid(recurrence, year, month);
              return (
                <SwipeToEditRow
                  className={`tx-item${expired ? " plan-item-expired" : ""}${paid ? " plan-item-paid" : ""}`}
                  key={recurrence.id}
                  disabled={paid}
                  onSwipe={() => openRecurrence(recurrence)}
                >
                  <button
                    className="plan-check"
                    type="button"
                    onClick={() => void toggleRecurrence(recurrence)}
                    title={paid ? "Marcar como não pago neste mês" : "Marcar como pago neste mês"}
                    aria-label={`${recurrence.description}: ${paid ? "marcar como não pago neste mês" : "marcar como pago neste mês"}`}
                    aria-pressed={paid}
                  >
                    {paid ? "✓" : "◯"}
                  </button>
                  <div className="tx-info">
                    <span className="tx-desc">{recurrence.description}</span>
                    <span className="plan-badge">{recurrence.category}</span>
                    <span className="plan-meta">
                      {periodLabel(recurrence.period)}{expired ? " · expirada" : ""}
                    </span>
                  </div>
                  <span className={`tx-val ${recurrence.type === "income" ? "in" : "out"}`}>{recurrence.type === "income" ? "+" : "−"} {currency(recurrence.amount)}</span>
                  <div className="planning-actions">
                    <button type="button" onClick={() => requestRemoveRecurrence(recurrence)} title="Excluir" aria-label={`Excluir ${recurrence.description}`}>×</button>
                  </div>
                </SwipeToEditRow>
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
              <div className="description-autocomplete" onFocusCapture={() => setDescriptionFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDescriptionFocused(false); }}>
              <input className="field" value={modal === "plan" ? planForm.description : recurrenceForm.description} onChange={(event) => modal === "plan" ? setPlanForm({ ...planForm, description: event.target.value }) : setRecurrenceForm({ ...recurrenceForm, description: event.target.value })} placeholder="Descrição" />
                {descriptionFocused && descriptionSuggestions.length > 0 && (
                  <div className="description-suggestions" role="listbox">
                    <span className="description-suggestions-label">Usados anteriormente</span>
                    {descriptionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="description-suggestion"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          updateDescription(suggestion);
                          setDescriptionFocused(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                {CATEGORY_LABELS.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              {actionError && <div className="msg-error">{actionError}</div>}
            </div>
            <div className="modal-footer"><button className="btn-outline" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary" onClick={() => void (modal === "plan" ? savePlan() : saveRecurrence())} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="pierre-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Excluir recorrência</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleting}>×</button>
            </div>
            <div className="modal-body">
              <p className="text-[var(--text2)]">
                Deseja excluir também todas as transações já lançadas da movimentação
                <strong> {deleteTarget.description}</strong>?
              </p>
              {actionError && <div className="msg-error">{actionError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn-outline" onClick={() => void confirmRemoveRecurrence(false)} disabled={deleting}>
                Só a recorrência
              </button>
              <button className="btn-danger" onClick={() => void confirmRemoveRecurrence(true)} disabled={deleting}>
                {deleting ? "Excluindo..." : "Recorrência + transações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
