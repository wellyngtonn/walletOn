"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createTransaction,
  listTransactions,
} from "@/services/transactions";
import {
  fetchPierreTransactions,
  triggerPierreUpdate,
  validatePierreKey,
  type PierreTransaction,
} from "@/services/pierre";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Falha ao sincronizar.";
  if (error.message.includes("401")) return "API Key inválida.";
  if (error.message.includes("403")) return "Acesso negado à API.";
  if (error.message.includes("404")) return "Endpoint não encontrado.";
  if (error.message.toLowerCase().includes("fetch")) {
    return "Problema de conexão (CORS?).";
  }
  return error.message.slice(0, 80) || "Falha ao sincronizar.";
}

export function PierreImport() {
  const { user } = useAuth();
  const [key, setKey] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPeriodo, setShowPeriodo] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [periodoStatus, setPeriodoStatus] = useState("");

  useEffect(() => {
    setKey("");
  }, []);

  async function importItems(
    items: PierreTransaction[],
    existing: Set<string>,
  ): Promise<number> {
    if (!user) return 0;

    let imported = 0;
    for (const item of items) {
      if (!item.id || existing.has(item.id)) continue;

      const date = new Date(`${item.date}T12:00:00`);
      if (Number.isNaN(date.getTime())) continue;

      try {
        await createTransaction(user.uid, {
          type: item.type === "receita" ? "income" : "expense",
          description: item.description,
          amount: item.amount,
          date: item.date,
          referenceMonth: date.getMonth() + 1,
          referenceYear: date.getFullYear(),
          pierreId: item.id,
          category: item.category,
          accountId: item.accountId,
        });
        existing.add(item.id);
        imported++;
      } catch {
        // Uma falha isolada não deve interromper a importação das demais.
      }
    }
    return imported;
  }

  async function loadExistingIds(): Promise<Set<string>> {
    if (!user) return new Set();
    const transactions = await listTransactions(user.uid);
    return new Set(
      transactions
        .map((transaction) => transaction.pierreId)
        .filter((id): id is string => Boolean(id)),
    );
  }

  async function testKey() {
    if (!key.trim()) {
      setToast("Cole sua API Key.");
      return;
    }

    setBusy(true);
    try {
      const result = await validatePierreKey(key.trim());
      setToast(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function sync12Meses() {
    if (!user || !key.trim()) {
      setToast("Configure a API Key primeiro.");
      return;
    }

    setBusy(true);
    setToast("Buscando dados do Pierre...");

    try {
      const validation = await validatePierreKey(key.trim());
      if (!validation.ok) throw new Error(validation.message);

      await triggerPierreUpdate(key.trim());

      const today = new Date();
      const ago = new Date();
      ago.setFullYear(today.getFullYear() - 1);
      const items = await fetchPierreTransactions(
        key.trim(),
        ago.toISOString().slice(0, 10),
        today.toISOString().slice(0, 10),
      );
      const imported = await importItems(items, await loadExistingIds());

      setToast(
        imported > 0
          ? `${imported} novas transações importadas!`
          : "Tudo atualizado! Nenhuma novidade.",
      );
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function toggleMonth(monthKey: string) {
    const next = new Set(selectedMonths);
    if (next.has(monthKey)) next.delete(monthKey);
    else next.add(monthKey);
    setSelectedMonths(next);
  }

  async function importPeriodo() {
    if (!user || !key.trim()) {
      setToast("Configure a API Key primeiro.");
      return;
    }
    if (!selectedMonths.size) {
      setToast("Selecione pelo menos 1 mês.");
      return;
    }

    setBusy(true);

    const meses = Array.from(selectedMonths)
      .map((monthKey) => {
        const [year, month] = monthKey.split("-").map(Number);
        return { year, month: month - 1 };
      })
      .sort(
        (a, b) =>
          a.year * 12 + a.month - (b.year * 12 + b.month),
      );

    let existing: Set<string>;
    try {
      existing = await loadExistingIds();
    } catch (error) {
      setToast(errorMessage(error));
      setBusy(false);
      return;
    }
    let total = 0;
    let errors = 0;

    for (const { year, month } of meses) {
      setPeriodoStatus(`Buscando ${MONTHS[month]} ${year}...`);
      try {
        await triggerPierreUpdate(key.trim());
        const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const end = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
        const items = await fetchPierreTransactions(key.trim(), start, end);
        const imported = await importItems(items, existing);
        total += imported;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${imported} importadas`);
      } catch (error) {
        errors++;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${errorMessage(error)}`);
      }
    }

    setShowPeriodo(false);
    setSelectedMonths(new Set());
    setPeriodoStatus("");
    setToast(
      `${total} transações de ${meses.length} ${meses.length === 1 ? "mês" : "meses"} importadas${errors ? ` (${errors} erro${errors === 1 ? "" : "s"})` : ""}.`,
    );
    setBusy(false);
  }

  function closePeriodo() {
    if (busy) return;
    setShowPeriodo(false);
    setSelectedMonths(new Set());
    setPeriodoStatus("");
  }

  return (
    <>
      <div className="settings-card">
        <h4 className="settings-card-title">Pierre Finance</h4>
        <p className="settings-card-desc">
          Conecte sua conta para importar transações automaticamente.
        </p>

        <div className="pierre-form">
          <input
            type="password"
            className="settings-input"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="sk-... (API Key)"
          />
          <button className="btn-primary" onClick={testKey} disabled={busy}>
            {busy ? "Testando..." : "Salvar Chave"}
          </button>
        </div>

        <div className="settings-actions">
          <button className="btn-outline" onClick={sync12Meses} disabled={busy}>
            {busy ? "Sincronizando..." : "Sincronizar Últimos 12 Meses"}
          </button>
          <button
            className="btn-outline"
            onClick={() => setShowPeriodo(true)}
            disabled={busy}
          >
            Importar por Período
          </button>
        </div>
      </div>

      {showPeriodo && (
        <div className="overlay" onClick={closePeriodo}>
          <div
            className="pierre-modal"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 380 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Selecionar Período</h3>
              <button className="modal-close" onClick={closePeriodo}>
                ×
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <button
                className="month-btn"
                onClick={() => setPickerYear(pickerYear - 1)}
              >
                ‹
              </button>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                {pickerYear}
              </span>
              <button
                className="month-btn"
                onClick={() => setPickerYear(pickerYear + 1)}
              >
                ›
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {MONTHS.map((month, index) => {
                const monthKey = `${pickerYear}-${String(index + 1).padStart(2, "0")}`;
                const selected = selectedMonths.has(monthKey);
                return (
                  <button
                    key={monthKey}
                    onClick={() => toggleMonth(monthKey)}
                    className="type-tab"
                    style={
                      selected
                        ? {
                            background: "var(--accent)",
                            borderColor: "var(--accent)",
                            color: "#fff",
                          }
                        : undefined
                    }
                  >
                    {month.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {periodoStatus && (
              <p
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text3)",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                {periodoStatus}
              </p>
            )}

            <div className="modal-footer">
              <button className="btn-outline" onClick={closePeriodo}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={importPeriodo}
                disabled={busy}
              >
                {busy ? "Importando..." : "Importar Selecionados"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 rounded-[20px] bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] shadow-lg"
          onClick={() => setToast("")}
        >
          {toast}
        </div>
      )}
    </>
  );
}
