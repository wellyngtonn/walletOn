export interface CategoryMeta {
  icon: string;
  color: string;
}

// Fonte única das categorias financeiras: rótulo, ícone e cor usados no
// planejamento, na análise mensal e nos ícones de transações importadas.
export const CATEGORY_META: Record<string, CategoryMeta> = {
  Alimentação: { icon: "🍱", color: "#ff6b35" },
  Supermercado: { icon: "🛒", color: "#43a047" },
  Restaurantes: { icon: "🍽️", color: "#ff7043" },
  Combustível: { icon: "⛽", color: "#ff9800" },
  Transporte: { icon: "🚗", color: "#2979ff" },
  Saúde: { icon: "💊", color: "#f44336" },
  Farmácia: { icon: "💊", color: "#e91e63" },
  Educação: { icon: "📚", color: "#7b1fa2" },
  Lazer: { icon: "🎮", color: "#ab47bc" },
  Viagem: { icon: "✈️", color: "#26a69a" },
  Moradia: { icon: "🏠", color: "#388e3c" },
  Salário: { icon: "💼", color: "#00c853" },
  Receitas: { icon: "💵", color: "#009688" },
  Investimento: { icon: "📈", color: "#00b0ff" },
  Vestuário: { icon: "👗", color: "#e91e63" },
  Pets: { icon: "🐾", color: "#ff8f00" },
  Beleza: { icon: "💅", color: "#f06292" },
  Compras: { icon: "🛍️", color: "#ffd600" },
  Contas: { icon: "📄", color: "#546e7a" },
  Assinaturas: { icon: "📱", color: "#3949ab" },
  Serviços: { icon: "🔧", color: "#5c6bc0" },
  Transferências: { icon: "↔️", color: "#607d8b" },
  Outros: { icon: "📦", color: "#8e8e93" },
};

export const CATEGORY_LABELS = Object.keys(CATEGORY_META);

export const DEFAULT_CATEGORY_META = CATEGORY_META.Outros;
