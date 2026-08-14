import { jsPDF } from "jspdf";
import type { Transaction } from "../types";
import { currency, dateBR } from "./format";
import { statementTotals, type StatementPeriod } from "./statement";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT: [number, number, number] = [79, 70, 229];
const TEXT: [number, number, number] = [28, 28, 30];
const MUTED: [number, number, number] = [107, 114, 128];
const BORDER: [number, number, number] = [229, 231, 235];
const INCOME: [number, number, number] = [22, 128, 60];
const EXPENSE: [number, number, number] = [198, 40, 40];

function periodLabel(period: StatementPeriod) {
  const month = (value: number) => String(value).padStart(2, "0");
  return `${period.fromYear}-${month(period.fromMonth)} a ${period.toYear}-${month(period.toMonth)}`;
}

function periodToken(period: StatementPeriod) {
  const month = (value: number) => String(value).padStart(2, "0");
  return `${period.fromYear}-${month(period.fromMonth)}-${period.toYear}-${month(period.toMonth)}`;
}

export function statementPdfFilename(period: StatementPeriod) {
  return `wallet-on-extrato-pierre-${periodToken(period)}.pdf`;
}

function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(...color);
}

function drawFooter(doc: jsPDF) {
  const page = doc.getCurrentPageInfo().pageNumber;
  const total = doc.getNumberOfPages();
  doc.setDrawColor(...BORDER);
  doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, MUTED);
  doc.text("WalletON - Extrato financeiro Pierre", MARGIN, PAGE_HEIGHT - 5);
  doc.text(`Pagina ${page} de ${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5, {
    align: "right",
  });
}

function drawPageHeader(
  doc: jsPDF,
  period: StatementPeriod,
  accountName: string | null,
  firstPage: boolean,
) {
  if (firstPage) {
    setTextColor(doc, ACCENT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("WALLETON", MARGIN, 16);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, 20, PAGE_WIDTH - MARGIN, 20);

    setTextColor(doc, TEXT);
    doc.setFontSize(20);
    doc.text("Extrato financeiro Pierre", MARGIN, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setTextColor(doc, MUTED);
    doc.text(`Periodo: ${periodLabel(period)}`, MARGIN, 39);
    doc.text(`Carteira: ${accountName || "Nao informada"}`, MARGIN, 45);
    doc.text(
      `Gerado em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())}`,
      PAGE_WIDTH - MARGIN,
      39,
      { align: "right" },
    );

    return 53;
  }

  setTextColor(doc, ACCENT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("WALLETON - EXTRATO PIERRE", MARGIN, 16);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 20, PAGE_WIDTH - MARGIN, 20);
  return 27;
}

function drawSummary(
  doc: jsPDF,
  items: Transaction[],
  startY: number,
) {
  const totals = statementTotals(items);
  const net = totals.income - totals.expense;
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * 2) / 3;
  const height = 22;
  const cards = [
    { label: "Entradas", value: currency(totals.income), color: INCOME },
    { label: "Saidas", value: currency(totals.expense), color: EXPENSE },
    {
      label: "Saldo liquido",
      value: `${net < 0 ? "- " : "+ "}${currency(Math.abs(net))}`,
      color: net < 0 ? EXPENSE : INCOME,
    },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, startY, width, height, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTextColor(doc, MUTED);
    doc.text(card.label, x + 5, startY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setTextColor(doc, card.color);
    doc.text(card.value, x + 5, startY + 16);
  });

  return startY + height + 10;
}

const columns = [
  { label: "Data", width: 24 },
  { label: "Descricao", width: 61 },
  { label: "Categoria", width: 37 },
  { label: "Tipo", width: 27 },
  { label: "Valor", width: 33 },
];

function drawTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(...BORDER);
  doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 10, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);

  let x = MARGIN + 3;
  columns.forEach((column, index) => {
    doc.text(column.label, index === columns.length - 1 ? x + column.width - 6 : x, y + 1, {
      align: index === columns.length - 1 ? "right" : "left",
    });
    x += column.width;
  });
  return y + 10;
}

function drawTransactionRow(doc: jsPDF, item: Transaction, y: number) {
  const fontSize = 8.5;
  const lineHeight = 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const description = doc.splitTextToSize(item.description, columns[1].width - 6) as string[];
  const category = doc.splitTextToSize(item.category || "Outros", columns[2].width - 6) as string[];
  const lines = Math.max(description.length, category.length, 1);
  const height = Math.max(9, lines * lineHeight + 4);

  setTextColor(doc, TEXT);
  doc.text(dateBR(item.date), MARGIN + 3, y + 5);
  doc.text(description, MARGIN + columns[0].width + 3, y + 5);
  doc.text(category, MARGIN + columns[0].width + columns[1].width + 3, y + 5);
  doc.text(
    item.type === "income" ? "Entrada" : "Saida",
    MARGIN + columns[0].width + columns[1].width + columns[2].width + 3,
    y + 5,
  );
  setTextColor(doc, item.type === "income" ? INCOME : EXPENSE);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${item.type === "income" ? "+" : "-"} ${currency(item.amount)}`,
    PAGE_WIDTH - MARGIN - 3,
    y + 5,
    { align: "right" },
  );

  doc.setDrawColor(...BORDER);
  doc.line(MARGIN, y + height, PAGE_WIDTH - MARGIN, y + height);
  return height;
}

export function createStatementPdf(
  items: Transaction[],
  period: StatementPeriod,
  accountName: string | null,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const sortedItems = [...items].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  let y = drawPageHeader(doc, period, accountName, true);
  y = drawSummary(doc, sortedItems, y);
  y = drawTableHeader(doc, y);

  if (!sortedItems.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, MUTED);
    doc.text("Nenhum lancamento no periodo.", PAGE_WIDTH / 2, y + 12, {
      align: "center",
    });
  } else {
    sortedItems.forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const description = doc.splitTextToSize(item.description, columns[1].width - 6) as string[];
      const category = doc.splitTextToSize(item.category || "Outros", columns[2].width - 6) as string[];
      const rowHeight = Math.max(9, Math.max(description.length, category.length) * 4.2 + 4);

      if (y + rowHeight > PAGE_HEIGHT - 17) {
        doc.addPage();
        y = drawPageHeader(doc, period, accountName, false);
        y = drawTableHeader(doc, y);
      }

      y += drawTransactionRow(doc, item, y);
    });
  }

  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    drawFooter(doc);
  }
  return doc;
}

export async function statementPdfBlob(
  items: Transaction[],
  period: StatementPeriod,
  accountName: string | null,
) {
  const pdf = createStatementPdf(items, period, accountName);
  return pdf.output("blob");
}
