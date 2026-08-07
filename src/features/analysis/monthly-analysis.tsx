"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TransactionList } from "@/components/transaction-list";
import type { Transaction, TransactionType } from "@/types";
import { currency } from "@/utils/format";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Alimentação: { icon: "🍱", color: "#ff6b35" },
  Transporte: { icon: "🚗", color: "#2979ff" },
  Saúde: { icon: "💊", color: "#f44336" },
  Educação: { icon: "📚", color: "#7b1fa2" },
  Lazer: { icon: "🎮", color: "#ab47bc" },
  Moradia: { icon: "🏠", color: "#388e3c" },
  Salário: { icon: "💼", color: "#00c853" },
  Investimento: { icon: "📈", color: "#00b0ff" },
  Vestuário: { icon: "👗", color: "#e91e63" },
  Pets: { icon: "🐾", color: "#ff8f00" },
  Beleza: { icon: "💅", color: "#f06292" },
  Compras: { icon: "🛍️", color: "#ffd600" },
  Contas: { icon: "📄", color: "#546e7a" },
  Assinaturas: { icon: "📱", color: "#3949ab" },
  Transferências: { icon: "↔️", color: "#607d8b" },
  Outros: { icon: "📊", color: "#8e8e93" },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  investment: "Investimento",
};

function categoryOf(transaction: Transaction) {
  return transaction.category || "Outros";
}

function monthTransactions(items: Transaction[], month: number, year: number) {
  return items.filter(
    (transaction) =>
      transaction.referenceMonth === month && transaction.referenceYear === year,
  );
}

function periodTransactions(items: Transaction[], month: number, year: number) {
  return items.filter((transaction) => {
    const date = new Date(`${transaction.date}T12:00:00`);
    return date.getMonth() === month && date.getFullYear() === year;
  });
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function download(name: string, content: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function MonthlyAnalysis({
  items,
  allItems,
  month,
  year,
  onEdit,
}: {
  items: Transaction[];
  allItems: Transaction[];
  month: number;
  year: number;
  onEdit: (transaction: Transaction) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  const monthItems = useMemo(
    () => monthTransactions(items, month, year),
    [items, month, year],
  );
  const pierreMonth = monthItems.filter((transaction) => transaction.pierreId);
  const categories = useMemo(
    () =>
      Array.from(new Set(monthItems.map(categoryOf))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [monthItems],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return monthItems.filter((transaction) => {
      const matchesType =
        typeFilter === "all" || transaction.type === typeFilter;
      const matchesCategory =
        categoryFilter === "all" || categoryOf(transaction) === categoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        transaction.description.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesCategory && matchesSearch;
    });
  }, [categoryFilter, monthItems, search, typeFilter]);

  const ranking = useMemo(() => {
    const values = new Map<string, number>();
    pierreMonth
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const category = categoryOf(transaction);
        values.set(category, (values.get(category) || 0) + transaction.amount);
      });
    const total = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(values.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([category, value]) => ({
        category,
        value,
        percentage: total ? (value / total) * 100 : 0,
        meta: CATEGORY_META[category] || CATEGORY_META.Outros,
      }));
  }, [pierreMonth]);

  const chartData = useMemo(() => {
    const periods = [];
    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(year, month - 1 - offset, 1);
      const periodItems = periodTransactions(
        allItems,
        date.getMonth(),
        date.getFullYear(),
      ).filter((transaction) => transaction.pierreId);
      periods.push({
        name: MONTHS[date.getMonth()].slice(0, 3),
        Receitas: periodItems
          .filter((transaction) => transaction.type === "income")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        Despesas: periodItems
          .filter((transaction) => transaction.type === "expense")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      });
    }
    return periods;
  }, [allItems, month, year]);

  const trends = useMemo(() => {
    const currentExpenses = pierreMonth
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const previous = new Date(year, month - 2, 1);
    const previousExpenses = periodTransactions(
      allItems,
      previous.getMonth(),
      previous.getFullYear(),
    )
      .filter(
        (transaction) => transaction.pierreId && transaction.type === "expense",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const previousChange = previousExpenses
      ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
      : 0;

    const threeMonths: number[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      const date = new Date(year, month - 1 - offset, 1);
      threeMonths.push(
        periodTransactions(allItems, date.getMonth(), date.getFullYear())
          .filter(
            (transaction) => transaction.pierreId && transaction.type === "expense",
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      );
    }
    const growth = threeMonths[0]
      ? ((threeMonths[2] - threeMonths[0]) / threeMonths[0]) * 100
      : 0;

    return { currentExpenses, previousChange, growth };
  }, [allItems, month, pierreMonth, year]);

  const forecast = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const currentDay =
      today.getFullYear() === year && today.getMonth() === month - 1
        ? today.getDate()
        : daysInMonth;
    const dailyVelocity = currentDay ? trends.currentExpenses / currentDay : 0;
    return {
      estimated: dailyVelocity * daysInMonth,
      daysRemaining: Math.max(daysInMonth - currentDay, 0),
      dailyVelocity,
      progress: Math.min((currentDay / daysInMonth) * 100, 100),
    };
  }, [month, trends.currentExpenses, year]);

  function exportCsv() {
    const rows = ["Data,Descrição,Tipo,Categoria,Valor"];
    filteredItems.forEach((transaction) => {
      rows.push(
        [
          transaction.date,
          escapeCsv(transaction.description),
          TYPE_LABELS[transaction.type],
          escapeCsv(categoryOf(transaction)),
          transaction.amount.toFixed(2).replace(".", ","),
        ].join(","),
      );
    });
    download(`analise-${year}-${String(month).padStart(2, "0")}.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  }

  function exportJson() {
    download(
      `analise-${year}-${String(month).padStart(2, "0")}.json`,
      JSON.stringify(filteredItems, null, 2),
      "application/json",
    );
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="sec-title">Análise Mensal</h2>
      </div>

      <div className="analysis-filters">
        <select
          className="analysis-select"
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as "all" | "income" | "expense")
          }
          aria-label="Filtrar por tipo"
        >
          <option value="all">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select
          className="analysis-select"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="analysis-grid">
        <div className="widget">
          <div className="analysis-widget-header">
            <h3 className="analysis-widget-title">Distribuição por Categoria</h3>
          </div>
          {ranking.length === 0 ? (
            <p className="tx-empty">Sem despesas no período</p>
          ) : (
            <div className="category-rank-list">
              {ranking.map((item, index) => (
                <div className="category-rank-row" key={item.category}>
                  <span className="category-rank-position">{index + 1}</span>
                  <span className="category-rank-icon">{item.meta.icon}</span>
                  <div className="category-rank-info">
                    <div className="category-rank-top">
                      <span className="category-rank-name">{item.category}</span>
                      <span className="category-rank-value">{currency(item.value)}</span>
                    </div>
                    <div className="category-rank-bar-wrap">
                      <div
                        className="category-rank-bar"
                        style={{ width: `${item.percentage}%`, background: item.meta.color }}
                      />
                    </div>
                  </div>
                  <span className="category-rank-percentage">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="widget">
          <div className="analysis-widget-header">
            <h3 className="analysis-widget-title">Receitas vs Despesas</h3>
          </div>
          <div className="analysis-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="Receitas" fill="#34c759" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ff3b30" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="widget analysis-full-card">
        <div className="analysis-widget-header">
          <h3 className="analysis-widget-title">Tendências Mensais</h3>
        </div>
        <div className="trend-grid">
          <div className="trend-item">
            <span className="trend-label">Vs Mês Passado</span>
            <strong className="trend-value">
              {trends.previousChange > 0 ? "↑" : "↓"} {Math.abs(trends.previousChange).toFixed(1)}%
            </strong>
            <small className="trend-caption">
              {trends.previousChange > 0 ? "Gastos aumentaram" : "Gastos diminuíram"}
            </small>
          </div>
          <div className="trend-item">
            <span className="trend-label">Maior Categoria</span>
            <strong className="trend-value">
              {ranking[0] ? `${ranking[0].meta.icon} ${ranking[0].category}` : "Sem dados"}
            </strong>
            <small className="trend-caption">
              {ranking[0] ? currency(ranking[0].value) : "-"}
            </small>
          </div>
          <div className="trend-item">
            <span className="trend-label">Taxa de Crescimento</span>
            <strong className="trend-value">
              {trends.growth > 0 ? "+" : ""}{trends.growth.toFixed(1)}%
            </strong>
            <small className="trend-caption">Últimos 3 meses</small>
          </div>
        </div>
      </div>

      <div className="widget analysis-full-card">
        <div className="analysis-widget-header">
          <h3 className="analysis-widget-title">Previsão até Fim do Mês</h3>
        </div>
        <div className="forecast-grid">
          <div className="forecast-item">
            <span className="forecast-label">Estimado em Gastos</span>
            <strong className="forecast-value">{currency(forecast.estimated)}</strong>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Dias Restantes</span>
            <strong className="forecast-value">{forecast.daysRemaining}</strong>
          </div>
          <div className="forecast-item">
            <span className="forecast-label">Velocidade Diária</span>
            <strong className="forecast-value">{currency(forecast.dailyVelocity)}</strong>
          </div>
        </div>
        <div className="forecast-progress">
          <div className="forecast-bar" style={{ width: `${forecast.progress}%` }} />
        </div>
        <p className="forecast-caption">Projeção baseada no ritmo médio de gastos do mês.</p>
      </div>

      <div className="widget analysis-full-card">
        <div className="analysis-widget-header">
          <h3 className="analysis-widget-title">Todas as Transações</h3>
          <div className="analysis-export-actions">
            <button className="btn-outline" onClick={exportCsv}>CSV</button>
            <button className="btn-outline" onClick={exportJson}>JSON</button>
          </div>
        </div>
        <div className="analysis-search-area">
          <input
            type="search"
            className="analysis-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome da transação..."
          />
          <small>Busca aplicada ao mês selecionado</small>
        </div>
        <TransactionList items={filteredItems} onEdit={onEdit} />
      </div>
    </>
  );
}
