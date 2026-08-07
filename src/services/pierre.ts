export const PIERRE_BASE = "https://www.pierre.finance/tools/api";

export interface PierreAccount {
  id: string;
  name: string;
  balance: number;
}

export interface PierreTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: "receita" | "despesa";
  category: string;
  accountId: string;
}

const CATEGORY_MAP: Record<string, string> = {
  Alimentação: "Alimentação",
  Educação: "Educação",
  Saúde: "Saúde",
  Transporte: "Transporte",
  Lazer: "Lazer",
  Moradia: "Moradia",
  Receitas: "Salário",
  Salário: "Salário",
  Investimentos: "Investimento",
  Investimento: "Investimento",
  Contas: "Contas",
  Compras: "Compras",
  Serviços: "Serviços",
  Assinaturas: "Assinaturas",
  Beleza: "Beleza",
  Vestuário: "Vestuário",
  Pets: "Pets",
  Viagem: "Lazer",
  Restaurantes: "Alimentação",
  Supermercado: "Alimentação",
  Farmácia: "Saúde",
  Combustível: "Transporte",
  Transferências: "Transferências",
  Renda: "Salário",
  Outros: "Outros",
};

const DESCRIPTION_MAP: Record<string, string> = {
  ifood: "Alimentação",
  "uber eats": "Alimentação",
  rappi: "Alimentação",
  supermercado: "Alimentação",
  mercado: "Alimentação",
  padaria: "Alimentação",
  uber: "Transporte",
  combustível: "Transporte",
  gasolina: "Transporte",
  farmácia: "Saúde",
  drogaria: "Saúde",
  hospital: "Saúde",
  netflix: "Lazer",
  spotify: "Lazer",
  disney: "Lazer",
  aluguel: "Moradia",
  condomínio: "Moradia",
  energia: "Moradia",
  internet: "Moradia",
  salário: "Salário",
  "transferência recebida": "Salário",
  tesouro: "Investimento",
  cdb: "Investimento",
  dividendo: "Investimento",
};

function mapCategory(category: string, description: string): string {
  if (category) return CATEGORY_MAP[category] || category;
  const normalized = description.toLowerCase();
  for (const [term, mapped] of Object.entries(DESCRIPTION_MAP)) {
    if (normalized.includes(term)) return mapped;
  }
  return "Outros";
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let value = String(raw ?? "")
    .replace(/\s/g, "")
    .replace("R$", "");
  if (value.includes(",") && value.includes(".")) {
    value =
      value.lastIndexOf(",") > value.lastIndexOf(".")
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  return Number.parseFloat(value) || 0;
}

function listFromResponse(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const response = data as Record<string, unknown>;
  const list = response.data || response.accounts || response.transactions || response.items;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}` };
}

export async function validatePierreKey(
  key: string,
): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${PIERRE_BASE}/get-accounts`, {
      headers: authHeaders(key),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, message: "Conexão estabelecida!" };
    if (response.status === 401) return { ok: false, message: "API Key inválida." };
    return { ok: false, message: `Erro HTTP ${response.status}.` };
  } catch {
    return { ok: false, message: "Sem conexão com o servidor." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function triggerPierreUpdate(key: string): Promise<void> {
  await fetch(`${PIERRE_BASE}/manual-update`, {
    method: "POST",
    headers: authHeaders(key),
  }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function fetchPierreAccounts(key: string): Promise<PierreAccount[]> {
  const response = await fetch(`${PIERRE_BASE}/get-accounts`, {
    headers: authHeaders(key),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const list = listFromResponse(await response.json());
  return list.map((account, index) => ({
    id: String(account.id || account.accountId || account._id || ""),
    name: `Carteira ${index + 1} - ${account.name || account.accountName || "Conta"}`,
    balance: parseAmount(
      account.balance ??
        account.current_balance ??
        account.available_balance ??
        account.currentBalance ??
        0,
    ),
  }));
}

export async function fetchPierreTransactions(
  key: string,
  startDate: string,
  endDate: string,
): Promise<PierreTransaction[]> {
  const params = new URLSearchParams({ startDate, endDate });
  const response = await fetch(`${PIERRE_BASE}/get-transactions?${params}`, {
    headers: authHeaders(key),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const list = listFromResponse(await response.json());
  return list.map((transaction) => {
    const rawAmount = transaction.amount ?? transaction.value ?? 0;
    const amount = parseAmount(rawAmount);
    const type = String(
      transaction.type || transaction.transactionType || transaction.direction || "",
    )
      .trim()
      .toUpperCase();
    const isDebit =
      ["DEBIT", "DESPESA", "EXPENSE", "OUT", "SAIDA", "SAÍDA"].includes(type) ||
      amount < 0;
    const rawDate = String(
      transaction.date ||
        transaction.dateTime ||
        transaction.transactionDate ||
        transaction.createdAt ||
        new Date().toISOString(),
    );
    const merchant = transaction.merchant;
    const merchantName =
      merchant && typeof merchant === "object"
        ? String((merchant as Record<string, unknown>).name || "")
        : "";
    const description = String(
      transaction.description || transaction.title || transaction.name || merchantName || "Pierre",
    ).slice(0, 120);

    return {
      id: String(transaction.id || transaction.transactionId || transaction._id || ""),
      description,
      amount: Math.abs(amount),
      date: rawDate.slice(0, 10),
      type: isDebit ? "despesa" : "receita",
      category: mapCategory(
        String(transaction.category || transaction.categoryName || ""),
        description,
      ),
      accountId: String(
        transaction.accountId || transaction.account_id || transaction.account || "",
      ),
    };
  });
}
