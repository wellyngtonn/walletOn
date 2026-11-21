"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { markBankSyncComplete } from "@/hooks/useBankAutoSync";
import { useBankProfile } from "@/hooks/useBankProfile";
import {
  createPluggyConnectToken,
  disconnectPluggy,
  savePluggyItem,
  syncPluggyRange,
  type PluggyAccount,
} from "@/services/pluggy";
import { saveAccountSelection } from "@/services/profile";
import { Toast } from "@/components/toast";

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
  const details = error as { code?: unknown; message?: unknown };
  const code = String(details?.code || "").toLowerCase();
  const message = String(
    details?.message || (error instanceof Error ? error.message : ""),
  );
  const detail = `${code} ${message}`.toLowerCase();
  if (detail.includes("unauthenticated")) return "Faça login para conectar.";
  if (detail.includes("412")) {
    return message.slice(0, 160) || "Conecte uma conta do Pluggy primeiro.";
  }
  if (detail.includes("401")) return "Sessão expirada. Faça login novamente.";
  if (detail.includes("403")) return "Acesso negado ao Pluggy.";
  if (detail.includes("429")) return "Limite da API atingido. Tente novamente em instantes.";
  if (detail.includes("503") || detail.includes("demorou")) {
    return message.slice(0, 160) || "O Pluggy está indisponível no momento.";
  }
  return message.slice(0, 160) || "Falha ao falar com o Pluggy.";
}

function statusLabel(status: string | null) {
  switch (status) {
    case "UPDATED":
      return "Sincronizada";
    case "UPDATING":
    case "CREATED":
      return "Sincronizando...";
    case "INVALID_CREDENTIALS":
    case "LOGIN_ERROR":
      return "Credenciais inválidas — atualize a conexão";
    case "WAITING_USER_INPUT":
      return "Aguardando confirmação no banco";
    case "WAITING_USER_ACTION":
      return "Aguardando ação no banco";
    case "OUTDATED":
      return "Desatualizada";
    default:
      return status || "Conectada";
  }
}

export function PluggyImport() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const {
    accounts: savedAccounts,
    accountId: savedAccountId,
    pluggyConnected,
    itemId: savedItemId,
    itemStatus,
    connectorName,
  } = useBankProfile(user?.uid);

  const [accounts, setAccounts] = useState<PluggyAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPeriodo, setShowPeriodo] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [periodoStatus, setPeriodoStatus] = useState("");

  useEffect(() => {
    setAccounts(savedAccounts);
    setSelectedAccountId((current) => {
      if (current && savedAccounts.some((account) => account.id === current)) {
        return current;
      }
      return savedAccountId || savedAccounts[0]?.id || "";
    });
  }, [savedAccounts, savedAccountId]);

  async function changeAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    if (!user || !account) return;

    setSelectedAccountId(account.id);
    setBusy(true);
    try {
      await saveAccountSelection(user.uid, "pluggy", account);
      setToast(`Carteira selecionada: ${account.name}`);
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function openWidget(mode: "create" | "update") {
    if (!user) {
      setToast("Faça login para conectar.");
      return;
    }
    if (mode === "update" && !savedItemId) {
      setToast("Nenhuma conexão do Pluggy para atualizar.");
      return;
    }

    setBusy(true);
    setToast(
      mode === "update" ? "Abrindo atualização..." : "Abrindo conexão...",
    );

    try {
      const { connectToken } = await createPluggyConnectToken(
        mode === "update" ? savedItemId : null,
      );
      const { PluggyConnect } = await import("pluggy-connect-sdk");
      const widget = new PluggyConnect({
        connectToken,
        updateItem: mode === "update" ? savedItemId || undefined : undefined,
        includeSandbox:
          process.env.NEXT_PUBLIC_PLUGGY_SANDBOX === "true" ||
          process.env.NODE_ENV !== "production",
        theme: resolvedTheme === "dark" ? "dark" : "light",
        language: "pt",
        onSuccess: ({ item }) => {
          void (async () => {
            try {
              if (!item?.id) {
                throw new Error("O Pluggy não retornou a conexão.");
              }
              const saved = await savePluggyItem(
                item.id,
                selectedAccountId || savedAccountId,
              );
              setAccounts(saved.accounts);
              setSelectedAccountId(
                saved.accounts.find(
                  (account) => account.id === selectedAccountId,
                )?.id ||
                  savedAccountId ||
                  saved.accounts[0]?.id ||
                  "",
              );
              markBankSyncComplete();
              setToast(saved.message);

              if (mode === "create" && saved.accounts.length > 0) {
                const today = new Date();
                const ago = new Date();
                ago.setFullYear(today.getFullYear() - 1);
                const result = await syncPluggyRange(
                  ago.toISOString().slice(0, 10),
                  today.toISOString().slice(0, 10),
                  saved.accounts.find(
                    (account) => account.id === selectedAccountId,
                  )?.id || saved.accounts[0]?.id,
                );
                markBankSyncComplete();
                setToast(
                  result.imported > 0
                    ? `Conexão criada e ${result.imported} transações importadas!`
                    : "Conexão criada! Nenhuma novidade por enquanto.",
                );
              }
            } catch (error) {
              setToast(errorMessage(error));
            } finally {
              setBusy(false);
            }
          })();
        },
        onError: ({ message, data }) => {
          const item = data?.item;
          if (item?.id) {
            void (async () => {
              try {
                await savePluggyItem(
                  item.id,
                  selectedAccountId || savedAccountId,
                );
                markBankSyncComplete();
              } catch {
                // A conexão pode continuar pendente no banco; o webhook
                // conclui a sincronização quando o usuário autorizar.
              } finally {
                setToast(
                  message ||
                    "Conexão criada, mas o banco ainda pede confirmação. Use “Atualizar conexão” em instantes.",
                );
                setBusy(false);
              }
            })();
            return;
          }
          setToast(message || "Falha ao conectar a conta.");
          setBusy(false);
        },
        onClose: () => setBusy(false),
      });
      await widget.init();
    } catch (error) {
      setToast(errorMessage(error));
      setBusy(false);
    }
  }

  async function sync12Meses() {
    if (!user || !pluggyConnected) {
      setToast("Conecte uma conta do Pluggy primeiro.");
      return;
    }

    setBusy(true);
    setToast("Buscando dados do Pluggy...");

    try {
      const today = new Date();
      const ago = new Date();
      ago.setFullYear(today.getFullYear() - 1);
      const result = await syncPluggyRange(
        ago.toISOString().slice(0, 10),
        today.toISOString().slice(0, 10),
        selectedAccountId || savedAccountId,
      );
      markBankSyncComplete();
      setToast(
        result.imported > 0
          ? `${result.imported} novas transações importadas!`
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
    if (!user || !pluggyConnected) {
      setToast("Conecte uma conta do Pluggy primeiro.");
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
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

    let total = 0;
    let errors = 0;
    let fatal = "";

    for (const { year, month } of meses) {
      setPeriodoStatus(`Buscando ${MONTHS[month]} ${year}...`);
      try {
        const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const end = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
        const result = await syncPluggyRange(
          start,
          end,
          selectedAccountId || savedAccountId,
        );
        total += result.imported;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${result.imported} importadas`);
      } catch (error) {
        if (String((error as { code?: unknown })?.code || "") === "412") {
          fatal = errorMessage(error);
          break;
        }
        errors++;
        setPeriodoStatus(`${MONTHS[month]} ${year}: ${errorMessage(error)}`);
      }
    }

    setShowPeriodo(false);
    setSelectedMonths(new Set());
    setPeriodoStatus("");
    if (fatal) {
      setToast(fatal);
      setBusy(false);
      return;
    }
    if (!errors) markBankSyncComplete();
    setToast(
      `${total} transações de ${meses.length} ${meses.length === 1 ? "mês" : "meses"} importadas${errors ? ` (${errors} erro${errors === 1 ? "" : "s"})` : ""}.`,
    );
    setBusy(false);
  }

  async function disconnect() {
    if (!user) return;
    if (
      !confirm(
        "Desconectar sua conta do Open Finance? Os lançamentos já importados serão mantidos.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await disconnectPluggy();
      setToast("Conexão do Pluggy removida.");
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
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
        <h4 className="settings-card-title">Open Finance (Pluggy)</h4>
        <p className="settings-card-desc">
          Conecte sua conta bancária com consentimento Open Finance e importe
          transações automaticamente.
        </p>

        {!pluggyConnected ? (
          <div className="settings-actions">
            <button
              className="btn-primary"
              onClick={() => void openWidget("create")}
              disabled={busy}
            >
              {busy ? "Abrindo..." : "Conectar conta"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-1 text-xs text-[var(--text3)]">
              <p>
                Status: <strong>{statusLabel(itemStatus)}</strong>
              </p>
              {connectorName ? <p>Conexão: {connectorName}</p> : null}
              {itemStatus &&
              itemStatus !== "UPDATED" &&
              itemStatus !== "UPDATING" &&
              itemStatus !== "CREATED" ? (
                <p>
                  Se o banco pedir confirmação, use “Atualizar conexão”.
                </p>
              ) : null}
            </div>

            <div className="settings-actions">
              <button
                className="btn-outline"
                onClick={sync12Meses}
                disabled={busy}
              >
                {busy ? "Sincronizando..." : "Sincronizar Últimos 12 Meses"}
              </button>
              <button
                className="btn-outline"
                onClick={() => setShowPeriodo(true)}
                disabled={busy}
              >
                Importar por Período
              </button>
              <button
                className="btn-outline"
                onClick={() => void openWidget("update")}
                disabled={busy}
              >
                Atualizar conexão
              </button>
              <button
                className="btn-danger"
                onClick={() => void disconnect()}
                disabled={busy}
              >
                Desconectar
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
                  <option value="">
                    O banco ainda está enviando as contas; sincronize em instantes
                  </option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} —{" "}
                      {account.balance.toLocaleString("pt-BR", {
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
          </>
        )}
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

      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  );
}
