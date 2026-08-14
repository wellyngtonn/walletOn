const CATEGORY_ICONS: Record<string, string> = {
  alimentacao: "🍱",
  transporte: "🚗",
  saude: "💊",
  educacao: "📚",
  lazer: "🎮",
  moradia: "🏠",
  salario: "💼",
  investimento: "📈",
  investimentos: "📊",
  vestuario: "👗",
  pets: "🐾",
  beleza: "💅",
  compras: "🛍️",
  contas: "📄",
  assinaturas: "📱",
  viagem: "✈️",
  restaurantes: "🍽️",
  supermercado: "🛒",
  farmacia: "💊",
  combustivel: "⛽",
  receitas: "💵",
  servicos: "🔧",
  transferencias: "↔️",
  outros: "📦",
};

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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function pierreCategoryIcon(
  category?: string,
  description?: string,
  type?: "income" | "expense" | "investment",
) {
  const categoryKey = normalize(category || "");
  if (CATEGORY_ICONS[categoryKey]) return CATEGORY_ICONS[categoryKey];

  const descriptionKey = normalize(description || "");
  const descriptionIcon = DESCRIPTION_ICONS.find(([term]) =>
    descriptionKey.includes(term),
  );
  if (descriptionIcon) return descriptionIcon[1];

  if (type === "income") return CATEGORY_ICONS.receitas;
  if (type === "investment") return CATEGORY_ICONS.investimento;
  return CATEGORY_ICONS.outros;
}
