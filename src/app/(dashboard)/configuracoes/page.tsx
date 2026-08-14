"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import {
  createShoppingItemsBatch,
  listShoppingItems,
} from "@/services/shopping";
import {
  createPlansBatch,
  createRecurrencesBatch,
  createTransactionsBatch,
  deletePlansBatch,
  deleteRecurrencesBatch,
  deleteTransactionsBatch,
  listPlans,
  listRecurrences,
  listTransactions,
} from "@/services/transactions";
import { PierreImport } from "@/components/pierre-import";
import { StatementExport } from "@/components/statement-export";
import type { AccentColor } from "@/types";
import {
  normalizeBackup,
  normalizePlan,
  normalizeRecurrence,
  normalizeShoppingItem,
  normalizeTransaction,
} from "@/utils/backup";

const accentColors: { name: AccentColor; hex: string; label: string }[] = [
  { name: "blue", hex: "#2979ff", label: "Azul" },
  { name: "green", hex: "#15b985", label: "Verde" },
  { name: "purple", hex: "#a64ce6", label: "Roxo" },
  { name: "orange", hex: "#ff701c", label: "Laranja" },
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState<AccentColor>("green");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("wallet-accent") ||
      "green") as AccentColor;
    setAccent(saved);
  }, []);

  function chooseAccent(c: AccentColor) {
    setAccent(c);
    localStorage.setItem("wallet-accent", c);
    document.documentElement.dataset.accent = c;
  }

  async function exportBackup() {
    if (!user) return;
    setToast("Preparando backup...");
    try {
      const [tx, plan, rec, shop] = await Promise.all([
        listTransactions(user.uid),
        listPlans(user.uid),
        listRecurrences(user.uid),
        listShoppingItems(user.uid),
      ]);
      const data = JSON.stringify({ tx, plan, rec, shop }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallet-on-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("Backup completo exportado com sucesso.");
    } catch (error) {
      setToast(error instanceof Error ? `Falha: ${error.message}` : "Falha ao exportar backup.");
    }
  }

  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setToast("Lendo backup...");
    try {
      const backup = normalizeBackup(JSON.parse(await file.text()));
      const transactionItems = backup.tx
        .map(normalizeTransaction)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const planItems = backup.plan
        .map(normalizePlan)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const recurrenceItems = backup.rec
        .map(normalizeRecurrence)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const shoppingItems = backup.shop
        .map(normalizeShoppingItem)
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.data.name.localeCompare(b.data.name, "pt-BR"))
        .map((item, index) => ({
          ...item,
          data: { ...item.data, order: index },
        }));

      if (!transactionItems.length && !planItems.length && !recurrenceItems.length && !shoppingItems.length) {
        throw new Error("O backup não contém dados financeiros compatíveis.");
      }

      const [existingTransactions, existingPlans, existingRecurrences, existingShopping] = await Promise.all([
        listTransactions(user.uid),
        listPlans(user.uid),
        listRecurrences(user.uid),
        listShoppingItems(user.uid),
      ]);
      const existingTransactionIds = new Set(existingTransactions.map((item) => item.id));
      const existingPierreIds = new Set(
        existingTransactions.map((item) => item.pierreId).filter(Boolean),
      );
      const existingPlanIds = new Set(existingPlans.map((item) => item.id));
      const existingRecurrenceIds = new Set(existingRecurrences.map((item) => item.id));
      const existingShoppingIds = new Set(existingShopping.map((item) => item.id));

      const newPlans = planItems.filter((item) => !item.id || !existingPlanIds.has(item.id));
      const newRecurrences = recurrenceItems.filter(
        (item) => !item.id || !existingRecurrenceIds.has(item.id),
      );
      const newShoppingItems = shoppingItems.filter(
        (item) => !item.id || !existingShoppingIds.has(item.id),
      );
      await Promise.all([
        createPlansBatch(user.uid, newPlans),
        createRecurrencesBatch(user.uid, newRecurrences),
      ]);

      const recurrenceIdMap = new Map<string, string>();
      recurrenceItems.forEach((item) => {
        if (!item.id) return;
        const existing = existingRecurrences.find((recurrence) => recurrence.id === item.id);
        recurrenceIdMap.set(item.oldId, existing?.id || item.id);
      });

      const newTransactions = transactionItems
        .map((item) => {
          const recurrenceId = item.data.recurrenceId
            ? recurrenceIdMap.get(item.data.recurrenceId) || item.data.recurrenceId
            : undefined;
          return {
            ...item,
            data: recurrenceId
              ? { ...item.data, recurrenceId }
              : item.data,
          };
        })
        .filter(
          (item) =>
            (!item.id || !existingTransactionIds.has(item.id)) &&
            (!item.data.pierreId || !existingPierreIds.has(item.data.pierreId)),
        );
      await createTransactionsBatch(user.uid, newTransactions);
      const newShoppingCount = await createShoppingItemsBatch(
        user.uid,
        newShoppingItems.map((item) => ({ id: item.id, data: item.data })),
      );

      const ignored =
        transactionItems.length - newTransactions.length +
        planItems.length - newPlans.length +
        recurrenceItems.length - newRecurrences.length +
        shoppingItems.length - newShoppingCount;
      setToast(
        `${newTransactions.length} transações, ${newPlans.length} planos, ${newRecurrences.length} recorrências e ${newShoppingCount} itens de compras importados${
          ignored ? ` (${ignored} já existentes ignorados)` : ""
        }.`,
      );
    } catch (error) {
      console.error("Falha ao importar backup", error);
      setToast(error instanceof Error ? `Falha: ${error.message}` : "Falha ao importar backup.");
    }
  }

  async function clearAll() {
    if (!user) return;
    if (
      !confirm(
        "Tem certeza? Esta ação apagará todas as suas transações e não pode ser desfeita.",
      )
    )
      return;
    setToast("Apagando dados...");
    try {
      const [transactions, plans, recurrences] = await Promise.all([
        listTransactions(user.uid),
        listPlans(user.uid),
        listRecurrences(user.uid),
      ]);
      await Promise.all([
        deleteTransactionsBatch(user.uid, transactions.map((item) => item.id)),
        deletePlansBatch(user.uid, plans.map((item) => item.id)),
        deleteRecurrencesBatch(user.uid, recurrences.map((item) => item.id)),
      ]);
      setToast(
        `${transactions.length + plans.length + recurrences.length} registros removidos.`,
      );
    } catch (error) {
      setToast(error instanceof Error ? `Falha: ${error.message}` : "Falha ao apagar dados.");
    }
  }

  if (!mounted) return null;

  return (
    <>
      <div className="mb-5">
        <h2 className="sec-title">Configurações</h2>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <h4 className="settings-card-title">Aparência</h4>
          <p className="settings-card-desc">
            Escolha entre tema claro, escuro e cor de destaque.
          </p>
          <div className="settings-form">
            <div className="toggle-group">
              <span className="toggle-label">Modo Escuro</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={resolvedTheme === "dark"}
                  onChange={(e) =>
                    setTheme(e.target.checked ? "dark" : "light")
                  }
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-group">
              <span className="toggle-label">Cor de destaque</span>
              <div className="flex gap-2">
                {accentColors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => chooseAccent(c.name)}
                    aria-label={c.label}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c.hex,
                      outline:
                        accent === c.name
                          ? "2px solid var(--text2)"
                          : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <PierreImport />

        <div className="settings-card">
          <h4 className="settings-card-title">Dados</h4>
          <p className="settings-card-desc">
            Exporte ou importe seus dados e gerencie suas transações.
          </p>
          <div className="settings-actions">
            <button onClick={exportBackup} className="btn-outline">
              Exportar Backup
            </button>
            <label className="btn-outline cursor-pointer text-center">
              Importar Backup
              <input
                type="file"
                accept=".json"
                onChange={importBackup}
                style={{ display: "none" }}
              />
            </label>
            <button onClick={clearAll} className="btn-danger">
              Apagar Todos os Dados
            </button>
          </div>
          <StatementExport onStatus={setToast} embedded />
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 rounded-[20px] bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] shadow-lg"
          onClick={() => setToast("")}
        >
          {toast}
        </div>
      )}
    </>
  );
}
