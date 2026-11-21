import { normalizeText } from "@/utils/text";
import { CATEGORY_META, DEFAULT_CATEGORY_META } from "@/utils/categories";

// Termos encontrados na descrição quando a categoria não é conhecida.
const DESCRIPTION_ICONS: Array<[string, string]> = [
  ["ifood", "🍱"],
  ["uber eats", "🍱"],
  ["rappi", "🍱"],
  ["supermercado", "🍱"],
  ["mercado", "🍱"],
  ["padaria", "🍱"],
  ["uber", "🚗"],
  ["gasolina", "⛽"],
  ["combustivel", "⛽"],
  ["farmacia", "💊"],
  ["drogaria", "💊"],
  ["hospital", "💊"],
  ["netflix", "🎮"],
  ["spotify", "🎮"],
  ["disney", "🎮"],
  ["aluguel", "🏠"],
  ["condominio", "🏠"],
  ["energia", "🏠"],
  ["internet", "🏠"],
  ["compra", "🛍️"],
  ["pix", "📦"],
];

// Chaves sem acento e plurais comuns para casar a categoria do Pierre com
// os rótulos canônicos acima.
const CATEGORY_ALIASES: Record<string, string> = {
  investimentos: "Investimento",
  transferencia: "Transferências",
  servico: "Serviços",
};

const categoryMetaByKey = new Map(
  Object.entries(CATEGORY_META).map(([label, meta]) => [normalizeText(label), meta]),
);

export function categoryMetaOf(category?: string) {
  const key = normalizeText(category || "");
  const canonical = CATEGORY_ALIASES[key] || key;
  return categoryMetaByKey.get(canonical);
}

export function categoryIcon(
  category?: string,
  description?: string,
  type?: "income" | "expense" | "investment",
) {
  const categoryMeta = categoryMetaOf(category);
  if (categoryMeta) return categoryMeta.icon;

  const descriptionKey = normalizeText(description || "");
  const descriptionIcon = DESCRIPTION_ICONS.find(([term]) =>
    descriptionKey.includes(term),
  );
  if (descriptionIcon) return descriptionIcon[1];

  if (type === "income") return CATEGORY_META.Receitas.icon;
  if (type === "investment") return CATEGORY_META.Investimento.icon;
  return DEFAULT_CATEGORY_META.icon;
}

export const pierreCategoryIcon = categoryIcon;
