"use client";

import { FileText, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { Transaction } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { listTransactions } from "@/services/transactions";
import { currency, dateBR } from "@/utils/format";
import {
  filterStatementTransactions,
  isValidStatementPeriod,
  statementTotals,
  type StatementPeriod,
} from "@/utils/statement";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const shortMonths = months.map((month) => month.slice(0, 3));

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] || character;
  });
}

function periodLabel(period: StatementPeriod) {
  return (
    months[period.fromMonth - 1] +
    " " +
    period.fromYear +
    " até " +
    months[period.toMonth - 1] +
    " " +
    period.toYear
  );
}

function printDocument(items: Transaction[], period: StatementPeriod) {
  const totals = statementTotals(items);
  const rows = items.length
    ? items
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (item) =>
            "<tr><td>" +
            escapeHtml(dateBR(item.date)) +
            "</td><td>" +
            escapeHtml(item.description) +
            "</td><td>" +
            (item.type === "income" ? "Entrada" : "Saída") +
            "</td><td class=\"amount " +
            (item.type === "income" ? "income" : "expense") +
            "\">" +
            (item.type === "income" ? "+" : "−") +
            " " +
            currency(item.amount) +
            "</td></tr>",
        )
        .join("")
    : '<tr><td colspan="4" class="empty">Nenhum lançamento no período.</td></tr>';

  return [
    "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">",
    "<title>Extrato WalletON</title><style>",
    "*{box-sizing:border-box}body{margin:0;padding:36px;color:#1c1c1e;font:14px Arial,sans-serif}",
    "header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #4f46e5;padding-bottom:18px}",
    "h1{margin:0 0 6px;font-size:24px}p{margin:4px 0;color:#6b7280}.date{text-align:right;font-size:12px}",
    ".totals{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.total{border-radius:10px;padding:14px;background:#f3f4f6}",
    ".total strong{display:block;margin-top:5px;font-size:18px}.income{color:#16803c}.expense{color:#c62828}",
    "table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left}",
    "th{color:#6b7280;font-size:11px;text-transform:uppercase}td.amount{text-align:right;white-space:nowrap;font-weight:700}",
    "th:last-child{text-align:right}.empty{padding:28px 8px;text-align:center;color:#6b7280}@media print{body{padding:0}}",
    "</style></head><body><header><div><h1>Extrato financeiro</h1><p>Período: ",
    escapeHtml(periodLabel(period)),
    "</p></div><p class=\"date\">WalletON<br>Gerado em ",
    escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())),
    "</p></header><section class=\"totals\"><div class=\"total\"><span>Entradas</span><strong class=\"income\">",
    currency(totals.income),
    "</strong></div><div class=\"total\"><span>Saídas</span><strong class=\"expense\">",
    currency(totals.expense),
    "</strong></div></section><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>",
    rows,
    "</tbody></table></body></html>",
  ].join("");
}

function whatsappMessage(items: Transaction[], period: StatementPeriod) {
  const totals = statementTotals(items);
  const lines = items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100)
    .map(
      (item) =>
        dateBR(item.date) +
        " · " +
        item.description +
        " · " +
        (item.type === "income" ? "+" : "−") +
        " " +
        currency(item.amount),
    );
  if (items.length > 100) lines.push("... e mais " + (items.length - 100) + " lançamentos.");
  return [
    "*Extrato financeiro — WalletON*",
    "Período: " + periodLabel(period),
    "",
    "Entradas: " + currency(totals.income),
    "Saídas: " + currency(totals.expense),
    "Saldo do período: " + currency(totals.income - totals.expense),
    "",
    lines.length ? lines.join("\n") : "Nenhum lançamento no período.",
  ].join("\n");
}

export function StatementExport({ onStatus }: { onStatus: (message: string) => void }) {
  const { user } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const [period, setPeriod] = useState<StatementPeriod>({
    fromMonth: now.getMonth() + 1,
    fromYear: now.getFullYear(),
    toMonth: now.getMonth() + 1,
    toYear: now.getFullYear(),
  });
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);

  function updatePeriod(field: keyof StatementPeriod, value: string) {
    setPeriod((current) => ({ ...current, [field]: Number(value) }));
  }

  async function getItems() {
    if (!user) throw new Error("Usuário não autenticado.");
    if (!isValidStatementPeriod(period)) {
      throw new Error("O período inicial deve ser anterior ao período final.");
    }
    return filterStatementTransactions(await listTransactions(user.uid), period);
  }

  async function exportPdf() {
    try {
      const items = await getItems();
      const popup = window.open("", "_blank", "width=960,height=760");
      if (!popup) {
        onStatus("Permita pop-ups no navegador para gerar o PDF.");
        return;
      }
      popup.opener = null;
      popup.document.write(printDocument(items, period));
      popup.document.close();
      popup.focus();
      window.setTimeout(() => popup.print(), 300);
      onStatus("Na janela aberta, escolha ‘Salvar como PDF’.");
    } catch (error) {
      onStatus(error instanceof Error ? "Falha: " + error.message : "Falha ao gerar extrato.");
    }
  }

  async function exportWhatsApp() {
    try {
      const items = await getItems();
      const url = "https://wa.me/?text=" + encodeURIComponent(whatsappMessage(items, period));
      window.open(url, "_blank", "noopener,noreferrer");
      onStatus("WhatsApp aberto com o extrato pronto para enviar.");
    } catch (error) {
      onStatus(error instanceof Error ? "Falha: " + error.message : "Falha ao preparar WhatsApp.");
    }
  }

  return (
    <div className="statement-export-card">
      <h4 className="statement-export-title">Exportar Extrato</h4>
      <p className="statement-export-desc">
        Exporte suas transações em PDF no formato de extrato financeiro.
      </p>
      <span className="statement-export-label">PERÍODO</span>
      <div className="statement-export-period">
        <select className="statement-export-select" aria-label="Mês inicial" value={period.fromMonth} onChange={(event) => updatePeriod("fromMonth", event.target.value)}>
          {shortMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
        </select>
        <select className="statement-export-select" aria-label="Ano inicial" value={period.fromYear} onChange={(event) => updatePeriod("fromYear", event.target.value)}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <span className="statement-export-to">até</span>
        <select className="statement-export-select" aria-label="Mês final" value={period.toMonth} onChange={(event) => updatePeriod("toMonth", event.target.value)}>
          {shortMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
        </select>
        <select className="statement-export-select" aria-label="Ano final" value={period.toYear} onChange={(event) => updatePeriod("toYear", event.target.value)}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      <div className="statement-export-actions">
        <button className="statement-export-pdf" onClick={() => void exportPdf()}>
          <FileText size={16} aria-hidden="true" /> Exportar Extrato PDF
        </button>
        <button className="statement-export-whatsapp" onClick={() => void exportWhatsApp()}>
          <MessageCircle size={16} aria-hidden="true" /> Enviar para WhatsApp
        </button>
      </div>
    </div>
  );
}
