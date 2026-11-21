"use client";

import { FileDown, Share2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listAccountTransactions } from "@/services/transactions";
import { useBankProfile } from "@/hooks/useBankProfile";
import { filterImportedMovements } from "@/utils/bank";
import {
  filterStatementTransactions,
  isValidStatementPeriod,
  statementPeriodBounds,
  type StatementPeriod,
} from "@/utils/statement";
import {
  createStatementPdf,
  statementPdfBlob,
  statementPdfFilename,
} from "@/utils/statement-pdf";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const shortMonths = months.map((month) => month.slice(0, 3));

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StatementExport({
  onStatus,
  embedded = false,
}: {
  onStatus: (message: string) => void;
  embedded?: boolean;
}) {
  const { user } = useAuth();
  const {
    accountId,
    accountName,
    loading: bankLoading,
  } = useBankProfile(user?.uid);
  const now = new Date();
  const currentYear = now.getFullYear();
  const [period, setPeriod] = useState<StatementPeriod>({
    fromMonth: now.getMonth() + 1,
    fromYear: now.getFullYear(),
    toMonth: now.getMonth() + 1,
    toYear: now.getFullYear(),
  });
  const [exporting, setExporting] = useState(false);
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);

  function updatePeriod(field: keyof StatementPeriod, value: string) {
    setPeriod((current) => ({ ...current, [field]: Number(value) }));
  }

  function setPreset(monthsBack: number) {
    const end = new Date(currentYear, now.getMonth(), 1);
    const start = new Date(currentYear, now.getMonth() - monthsBack + 1, 1);
    setPeriod({
      fromMonth: start.getMonth() + 1,
      fromYear: start.getFullYear(),
      toMonth: end.getMonth() + 1,
      toYear: end.getFullYear(),
    });
  }

  async function getItems() {
    if (!user) throw new Error("Usuário não autenticado.");
    if (bankLoading) throw new Error("A carteira ainda está carregando.");
    if (!accountId) throw new Error("Nenhuma carteira foi selecionada.");
    if (!isValidStatementPeriod(period)) {
      throw new Error("O período inicial deve ser anterior ao período final.");
    }

    const { fromDate, toDate } = statementPeriodBounds(period);
    const accountItems = await listAccountTransactions(user.uid, accountId, fromDate, toDate);
    return filterStatementTransactions(filterImportedMovements(accountItems, accountId), period);
  }

  async function exportPdf() {
    if (exporting) return;
    if (!user) {
      onStatus("Usuário não autenticado.");
      return;
    }
    if (bankLoading) {
      onStatus("Aguarde o carregamento da carteira.");
      return;
    }
    if (!accountId) {
      onStatus("Nenhuma carteira foi selecionada.");
      return;
    }
    if (!isValidStatementPeriod(period)) {
      onStatus("O período inicial deve ser anterior ao período final.");
      return;
    }

    setExporting(true);
    onStatus("Gerando arquivo PDF...");
    try {
      const items = await getItems();
      const pdf = createStatementPdf(items, period, accountName);
      pdf.save(statementPdfFilename(period));
      onStatus("PDF baixado com sucesso.");
    } catch (error) {
      onStatus(error instanceof Error ? "Falha: " + error.message : "Falha ao gerar PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function sharePdf() {
    if (exporting) return;
    if (!user) {
      onStatus("Usuário não autenticado.");
      return;
    }
    if (bankLoading || !accountId) {
      onStatus("Aguarde a seleção de uma carteira.");
      return;
    }
    if (!isValidStatementPeriod(period)) {
      onStatus("O período inicial deve ser anterior ao período final.");
      return;
    }

    setExporting(true);
    onStatus("Preparando PDF para compartilhar...");
    try {
      const items = await getItems();
      const blob = await statementPdfBlob(items, period, accountName);
      const filename = statementPdfFilename(period);
      const file = new File([blob], filename, { type: "application/pdf" });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: "Extrato financeiro",
          text: `Extrato - ${accountName || "Carteira"}`,
          files: [file],
        });
        onStatus("PDF compartilhado com sucesso.");
      } else {
        downloadBlob(blob, filename);
        onStatus("Este navegador não permite compartilhar arquivos. PDF baixado.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        onStatus("Compartilhamento cancelado.");
      } else {
        onStatus(error instanceof Error ? "Falha: " + error.message : "Falha ao compartilhar PDF.");
      }
    } finally {
      setExporting(false);
    }
  }

  const accountLabel = bankLoading
    ? "Carregando carteira..."
    : accountName || "Nenhuma carteira selecionada";

  return (
    <div className={`statement-export-card ${embedded ? "statement-export-embedded" : ""}`}>
      <h4 className="statement-export-title">Exportar Extrato</h4>
      <p className="statement-export-desc">
        Gere um arquivo PDF com as movimentações financeiras importadas da sua conta.
        <span className="statement-export-account">Carteira: <strong>{accountLabel}</strong></span>
      </p>
      <span className="statement-export-label">PERÍODO</span>
      <div className="statement-export-presets" aria-label="Períodos rápidos">
        <button type="button" onClick={() => setPreset(1)}>Este mês</button>
        <button type="button" onClick={() => setPreset(3)}>Últimos 3 meses</button>
        <button type="button" onClick={() => setPreset(6)}>Últimos 6 meses</button>
      </div>
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
        <button
          type="button"
          className="statement-export-pdf"
          onClick={() => void exportPdf()}
          disabled={exporting}
          aria-busy={exporting}
        >
          <FileDown size={16} aria-hidden="true" />
          {exporting ? "Gerando PDF..." : "Baixar Extrato PDF"}
        </button>
        <button
          type="button"
          className="statement-export-share"
          onClick={() => void sharePdf()}
          disabled={exporting}
          aria-busy={exporting}
        >
          <Share2 size={16} aria-hidden="true" /> Compartilhar PDF
        </button>
      </div>
    </div>
  );
}
