const PIERRE_BASE = "https://www.pierre.finance/tools/api";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let value = String(raw ?? "").replace(/\s/g, "").replace(/^R\$/i, "");
  if (value.includes(",") && value.includes(".")) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function listFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const response = data;
  const list = response.data || response.accounts || response.transactions || response.items;
  return Array.isArray(list) ? list : [];
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapCategory(category, description) {
  const normalized = normalizeText(category || description);
  const mappings = [
    [["alimentacao", "ifood", "uber eats", "rappi", "supermercado", "mercado", "padaria", "restaurante"], "Alimentação"],
    [["educacao"], "Educação"],
    [["saude", "farmacia", "drogaria", "hospital"], "Saúde"],
    [["transporte", "uber", "gasolina", "combustivel"], "Transporte"],
    [["lazer", "netflix", "spotify", "disney", "viagem"], "Lazer"],
    [["moradia", "aluguel", "condominio", "energia", "internet"], "Moradia"],
    [["salario", "receita", "renda", "transferencia recebida"], "Salário"],
    [["investimento", "investimentos", "tesouro", "cdb", "dividendo"], "Investimento"],
    [["contas"], "Contas"],
    [["compras"], "Compras"],
    [["servicos"], "Serviços"],
    [["assinaturas"], "Assinaturas"],
    [["beleza"], "Beleza"],
    [["vestuario"], "Vestuário"],
    [["pets"], "Pets"],
    [["transferencias"], "Transferências"],
  ];
  const match = mappings.find(([terms]) => terms.some((term) => normalized.includes(term)));
  return match ? match[1] : "Outros";
}

async function request(path, key, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${PIERRE_BASE}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function validateKey(key) {
  try {
    const response = await request("/get-accounts", key);
    if (response.ok) return { ok: true, message: "Conexão estabelecida!" };
    if (response.status === 401) return { ok: false, message: "API Key inválida." };
    return { ok: false, message: `Erro HTTP ${response.status}.` };
  } catch {
    return { ok: false, message: "Sem conexão com o servidor." };
  }
}

async function triggerUpdate(key) {
  await request("/manual-update", key, { method: "POST" }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function fetchAccounts(key) {
  const response = await request("/get-accounts", key);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return listFromResponse(await response.json()).map((account, index) => ({
    id: String(account.id || account.accountId || account._id || ""),
    name: `Carteira ${index + 1} - ${account.name || account.accountName || "Conta"}`,
    balance: parseAmount(account.balance ?? account.current_balance ?? account.available_balance ?? account.currentBalance ?? 0),
  })).filter((account) => account.id);
}

async function fetchTransactions(key, startDate, endDate) {
  const params = new URLSearchParams({ startDate, endDate });
  const response = await request(`/get-transactions?${params}`, key);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return listFromResponse(await response.json()).map((transaction) => {
    const amount = parseAmount(transaction.amount ?? transaction.value ?? 0);
    const type = String(transaction.type || transaction.transactionType || transaction.direction || "").trim().toUpperCase();
    const isDebit = ["DEBIT", "DESPESA", "EXPENSE", "OUT", "SAIDA", "SAÍDA"].includes(type) || amount < 0;
    const merchant = transaction.merchant;
    const merchantName = merchant && typeof merchant === "object" ? String(merchant.name || "") : "";
    const description = String(transaction.description || transaction.title || transaction.name || merchantName || "Pierre").slice(0, 120);
    const date = String(transaction.date || transaction.dateTime || transaction.transactionDate || transaction.createdAt || "").slice(0, 10);
    return {
      id: String(transaction.id || transaction.transactionId || transaction._id || ""),
      description,
      amount: Math.abs(amount),
      date,
      type: isDebit ? "expense" : "income",
      category: mapCategory(transaction.category || transaction.categoryName, description),
      accountId: String(transaction.accountId || transaction.account_id || transaction.account || ""),
    };
  }).filter((transaction) => transaction.id && transaction.amount > 0 && validDate(transaction.date));
}

module.exports = {
  fetchAccounts,
  fetchTransactions,
  triggerUpdate,
  validateKey,
};
