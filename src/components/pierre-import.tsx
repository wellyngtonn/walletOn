"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  markPierreSyncComplete,
} from "@/hooks/usePierreAutoSync";
import { usePierreBalance } from "@/hooks/usePierreBalance";
import {
  savePierreKey,
  syncPierreRange,
  type PierreAccount,
} from "@/services/pierre";
import {
  savePierreAccountSelection,
} from "@/services/profile";

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
  const {
    accounts: savedAccounts,
    accountId: savedAccountId,
    hasApiKey,
  } = usePierreBalance(user?.uid);
  const [key, setKey] = useState("");
  const [accounts, setAccounts] = useState<PierreAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPeriodo, setShowPeriodo] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [periodoStatus, setPeriodoStatus] = useState("");

  useEffect(() => {
    setAccounts(savedAccounts);
    setSelectedAccountId(savedAccountId || savedAccounts[0]?.id || "");
  }, [savedAccounts, savedAccountId]);

  async function changeAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    if (!user || !account) return;

    setSelectedAccountId(account.id);
    setBusy(true);
    try {
      await savePierreAccountSelection(user.uid, account);
      setToast(`Carteira selecionada: ${account.name}`);
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function testKey() {
    if (!key.trim()) {
      setToast("Cole sua API Key.");
      return;
    }

    setBusy(true);
    try {
      const saved = await savePierreKey(key.trim(), selectedAccountId || savedAccountId);
      setAccounts(saved.accounts);
      setSelectedAccountId(
        saved.accounts.find((account) => account.id === selectedAccountId)?.id ||
          saved.accounts[0]?.id ||
          "",
      );
      setToast(saved.message);
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function sync12Meses() {
    if (!user || (!key.trim() && !hasApiKey)) {
      setToast("Configure a API Key primeiro.");
      return;
    }

    setBusy(true);
    setToast("Buscando dados do Pierre...");

    try {
      const today = new Date();
      const ago = new Date();
      ago.setFullYear(today.getFullYear() - 1);
      if (key.trim()) {
        const saved = await savePierreKey(key.trim(), selectedAccountId || savedAccountId);
        setAccounts(saved.accounts);
      }
      const importedResult = await syncPierreRange(
        ago.toISOString().slice(0, 10),
        today.toISOString().slice(0, 10),
        selectedAccountId || savedAccountId,
      );
      const imported = importedResult.imported;
      markPierreSyncComplete();

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
    if (!user || (!key.trim() && !hasApiKey)) {
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

    let total = 0;
    let errors = 0;

    try {
      if (key.trim()) {
        const result = await savePierreKey(key.trim(), selectedAccountId || savedAccountId);
        setAccounts(result.accounts);
      }
    } catch (error) {
      setToast(errorMessage(error));
      setBusy(false);
      return;
    }

    for (const { year, month } of meses) {
      setPeriodoStatus(`Buscando ${MONTHS[month]} ${year}...`);
      try {
        const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const end = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
        const result = await syncPierreRange(start, end, selectedAccountId || savedAccountId);
        total += result.imported;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${result.imported} importadas`);
      } catch (error) {
        errors++;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${errorMessage(error)}`);
      }
    }

    setShowPeriodo(false);
    setSelectedMonths(new Set());
    setPeriodoStatus("");
    if (!errors) markPierreSyncComplete();
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
            placeholder={hasApiKey ? "Chave configurada; cole outra para substituir" : "sk-... (API Key)"}
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

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-[var(--text3)]">
            Carteira exibida no Resumo
          </label>
          <select
            className="settings-input w-full"
            value={selectedAccountId}
            onChange={(event) => void changeAccount(event.target.value)}
            disabled={busy || accounts.length === 0}
          >
            {accounts.length === 0 ? (
              <option value="">Valide a API Key para carregar as carteiras</option>
            ) : (
              accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {account.balance.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </option>
              ))
            )}
          </select>
          <p className="mt-1.5 text-xs text-[var(--text3)]">
            O Resumo mostra somente o saldo e os lançamentos desta carteira.
          </p>
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
