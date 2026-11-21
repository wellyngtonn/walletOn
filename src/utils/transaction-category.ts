import { CATEGORY_META } from "./categories.js";
import { normalizeText } from "./text.js";

export type CategorizableTransactionType =
  | "income"
  | "expense"
  | "investment";

export interface CategorizationInput {
  description?: string | null;
  /** Categoria já existente, do provedor ou manual. */
  category?: string | null;
  categoryId?: string | null;
  merchantName?: string | null;
  merchantCategory?: string | null;
  operationType?: string | null;
  type?: CategorizableTransactionType;
}

type CategoryRule = [RegExp, string];

const CATEGORY_BY_KEY = new Map(
  Object.keys(CATEGORY_META).map((label) => [normalizeText(label), label]),
);

// Sinônimos em português e inglês, inclusive os rótulos do Pluggy.
const CATEGORY_ALIASES: Record<string, string> = {
  alimentacao: "Alimentação",
  restaurante: "Restaurantes",
  supermercados: "Supermercado",
  combustiveis: "Combustível",
  transportes: "Transporte",
  saude: "Saúde",
  farmacias: "Farmácia",
  educacao: "Educação",
  viagens: "Viagem",
  salarios: "Salário",
  receita: "Receitas",
  investimentos: "Investimento",
  vestuario: "Vestuário",
  pet: "Pets",
  compras: "Compras",
  contas: "Contas",
  assinatura: "Assinaturas",
  servico: "Serviços",
  transferencia: "Transferências",
  outros: "Outros",
  groceries: "Supermercado",
  grocery: "Supermercado",
  supermarket: "Supermercado",
  "food and drinks": "Alimentação",
  "eating out": "Restaurantes",
  "food delivery": "Restaurantes",
  restaurant: "Restaurantes",
  restaurants: "Restaurantes",
  "gas station": "Combustível",
  "gas stations": "Combustível",
  fuel: "Combustível",
  transportation: "Transporte",
  transport: "Transporte",
  "taxi and ride-hailing": "Transporte",
  "public transportation": "Transporte",
  healthcare: "Saúde",
  health: "Saúde",
  pharmacy: "Farmácia",
  education: "Educação",
  leisure: "Lazer",
  entertainment: "Lazer",
  travel: "Viagem",
  housing: "Moradia",
  rent: "Moradia",
  utilities: "Moradia",
  salary: "Salário",
  income: "Receitas",
  investment: "Investimento",
  investments: "Investimento",
  clothing: "Vestuário",
  "pet supplies and vet": "Pets",
  pets: "Pets",
  "wellness and fitness": "Beleza",
  beauty: "Beleza",
  shopping: "Compras",
  "online shopping": "Compras",
  electronics: "Compras",
  taxes: "Contas",
  "bank fees": "Contas",
  insurance: "Contas",
  "loans and financing": "Contas",
  "legal obligations": "Contas",
  services: "Serviços",
  "digital services": "Assinaturas",
  "video streaming": "Assinaturas",
  "music streaming": "Assinaturas",
  gaming: "Lazer",
  transfers: "Transferências",
  transfer: "Transferências",
  "same person transfer": "Transferências",
  donations: "Outros",
  gambling: "Outros",
};

// Categorias da árvore do Pluggy (inglês). As regras mais específicas vêm
// primeiro para não serem capturadas por categorias-pai genéricas.
const PROVIDER_CATEGORY_RULES: CategoryRule[] = [
  [/\b(salary|payroll|retirement|government aid|non-recurring income)\b/, "Salário"],
  [/\b(pharmacy|drugstore)\b/, "Farmácia"],
  [/\b(gas stations?|fuel|gasoline)\b/, "Combustível"],
  [/\b(grocer(y|ies)|supermarket)\b/, "Supermercado"],
  [/\b(eating out|food delivery)\b/, "Restaurantes"],
  [/\b(food and drinks)\b/, "Alimentação"],
  [/\b(video streaming|music streaming|digital services?)\b/, "Assinaturas"],
  [
    /\b(gaming|cinema|theater|concert|leisure|entertainment|stadiums?|arenas?|museums?|landmarks?)\b/,
    "Lazer",
  ],
  [/\b(education|school|university|course|kindergarten|online courses?)\b/, "Educação"],
  [/\b(clothing|fashion)\b/, "Vestuário"],
  [/\b(pet supplies|veterinary|pets?)\b/, "Pets"],
  [/\b(beauty|wellness|fitness|salon)\b/, "Beleza"],
  [/\b(hospital|clinics?|health(care)?|dentist|optometry|labs?)\b/, "Saúde"],
  [/\b(hotel|airlines?|accommodation|travel|mileage|bus tickets?)\b/, "Viagem"],
  [/\b(rent|utilities|electricity|water|housing|urban land)\b/, "Moradia"],
  [
    /\b(investments?|fixed income|mutual funds?|variable income|pension|proceeds)\b/,
    "Investimento",
  ],
  [
    /\b(transfers?|same person transfer|ted|doc|pix|bank slip|boleto|credit card payment)\b/,
    "Transferências",
  ],
  [
    /\b(taxes|income taxes|fees?|bank fees|insurance|loans?|financing|legal obligations?|alimony)\b/,
    "Contas",
  ],
  [
    /\b(transportation|taxi|ride-hailing|public transportation|automotive|car rental|bicycle|parking|tolls?|traffic tickets?|vehicle maintenance)\b/,
    "Transporte",
  ],
  [/\b(telecommunications?|internet|mobile|tv|services?)\b/, "Serviços"],
  [
    /\b(shopping|online shopping|electronics|bookstore|office supplies|sports goods|cashback)\b/,
    "Compras",
  ],
  [/\b(income|deposit)\b/, "Receitas"],
  [/\b(donations?|gambling|lottery|online bet)\b/, "Outros"],
];

// Termos comuns em extratos e estabelecimentos brasileiros. A ordem importa:
// nomes compostos e casos específicos vêm antes dos genéricos.
const DESCRIPTION_RULES: CategoryRule[] = [
  [/\b(mercado livre|mercadolivre)\b/, "Compras"],
  [/\b(amazon prime)\b/, "Assinaturas"],
  [
    /\b(ifood|rappi|uber ?eats|delivery|restaurante|lanchonete|pizzaria|hamburgueria|burger|mcdonald|starbucks|subway|outback|cafe|padaria|panificadora|acougue|sorveteria)\b/,
    "Restaurantes",
  ],
  [
    /\b(supermercado|carrefour|pao de acucar|assai|atacadao|hortifruti|zaffari|walmart|mercado|extra)\b/,
    "Supermercado",
  ],
  [/\b(posto|gasolina|etanol|combustivel|shell|ipiranga|petrobras)\b/, "Combustível"],
  [
    /\b(uber|99app|99pop|99|cabify|taxi|onibus|metro|bilhete unico|pedagio|estacionamento|sem parar|veloe|conectcar)\b/,
    "Transporte",
  ],
  [/\b(farmacia|drogaria|drogasil|droga raia|pacheco|ultrafarma)\b/, "Farmácia"],
  [
    /\b(hospital|clinica|laboratorio|exame|dentista|odontologia|unimed|amil|hapvida|sulamerica)\b/,
    "Saúde",
  ],
  [/\b(escola|faculdade|universidade|curso|udemy|alura|colegio|creche)\b/, "Educação"],
  [
    /\b(netflix|spotify|disney|prime video|globoplay|deezer|youtube premium|icloud|google one|microsoft 365|adobe|chatgpt|openai|canva|assinatura)\b/,
    "Assinaturas",
  ],
  [
    /\b(cinema|ingresso|show|teatro|steam|playstation|xbox|nintendo|jogo|parque)\b/,
    "Lazer",
  ],
  [
    /\b(hotel|pousada|airbnb|booking|decolar|cvc|latam|gol|azul|passagem|viagem)\b/,
    "Viagem",
  ],
  [
    /\b(aluguel|condominio|energia|luz|agua|sabesp|enel|cemig|comgas|internet|vivo|claro|tim|oi|telefone)\b/,
    "Moradia",
  ],
  [/\b(salario|folha|provento|13o|ferias)\b/, "Salário"],
  [
    /\b(investimento|aplicacao|resgate|fundo|cdb|tesouro|corretora|rico|xp invest|clear|nuinvest|poupanca|rendimento)\b/,
    "Investimento",
  ],
  [
    /\b(roupa|vestuario|zara|renner|riachuelo|c&a|shein|nike|adidas|centauro|calcado|moda)\b/,
    "Vestuário",
  ],
  [/\b(pet|petshop|cobasi|petz|veterinario|racao)\b/, "Pets"],
  [
    /\b(salao|barbearia|beleza|estetica|manicure|cabeleireiro|sephora|boticario|natura|avon)\b/,
    "Beleza",
  ],
  [
    /\b(amazon|shopee|aliexpress|magalu|americanas|casas bahia|eletro|celular|informatica)\b/,
    "Compras",
  ],
  [
    /\b(compra|compra cartao|compra no debito|compra no credito|compra internacional|compra parcelada)\b/,
    "Compras",
  ],
  [/\b(estorno|reembolso)\b/, "Receitas"],
  [
    /\b(boleto|fatura|imposto|iof|ipva|iptu|licenciamento|seguro|tarifa|anuidade|taxa|debito automatico|deb aut)\b/,
    "Contas",
  ],
  [
    /\b(servico|manutencao|reparo|oficina|lavanderia|dedetizacao|faxina|diarista)\b/,
    "Serviços",
  ],
  [/\b(pix|ted|doc|transferencia|saque|deposito)\b/, "Transferências"],
];

const OPERATION_TYPE_CATEGORIES: Record<string, string> = {
  FOLHA_PAGAMENTO: "Salário",
  PIX: "Transferências",
  TED: "Transferências",
  DOC: "Transferências",
  TRANSFERENCIA_MESMA_INSTITUICAO: "Transferências",
  DEPOSITO: "Transferências",
  SAQUE: "Transferências",
  BOLETO: "Contas",
  CONVENIO_ARRECADACAO: "Contas",
  TARIFA_SERVICOS: "Serviços",
  PACOTE_TARIFA_SERVICOS: "Serviços",
  RENDIMENTO_APLIC_FINANCEIRA: "Investimento",
  RESGATE_APLIC_FINANCEIRA: "Investimento",
  PAGAMENTO_FATURA: "Transferências",
  ESTORNO: "Receitas",
  OPERACAO_CREDITO: "Contas",
  CARTAO: "Compras",
};

function matchRule(text: string, rules: CategoryRule[]) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const [pattern, category] of rules) {
    if (pattern.test(normalized)) return category;
  }
  return null;
}

export function canonicalCategory(value?: string | null) {
  const key = normalizeText(value || "");
  if (!key) return null;
  return CATEGORY_BY_KEY.get(key) || CATEGORY_ALIASES[key] || null;
}

export function isKnownCategory(value?: string | null) {
  const category = canonicalCategory(value);
  return Boolean(category && category !== "Outros");
}

/**
 * Resolve a categoria final de um lançamento:
 * 1. categoria do provedor quando já é uma categoria do app;
 * 2. árvore de categorias do Pluggy;
 * 3. palavras-chave da descrição/estabelecimento;
 * 4. tipo de operação bancária;
 * 5. fallback pelo tipo do lançamento.
 */
export function categorizeTransaction(input: CategorizationInput): string {
  const existing = canonicalCategory(input.category);
  if (existing && existing !== "Outros") return existing;

  const providerText = [input.category, input.merchantCategory]
    .filter(Boolean)
    .join(" ");
  const providerCategory = matchRule(providerText, PROVIDER_CATEGORY_RULES);
  if (providerCategory) return providerCategory;

  const descriptionText = [input.description, input.merchantName]
    .filter(Boolean)
    .join(" ");
  const descriptionCategory = matchRule(descriptionText, DESCRIPTION_RULES);
  if (descriptionCategory) return descriptionCategory;

  const operationType = (input.operationType || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (operationType && OPERATION_TYPE_CATEGORIES[operationType]) {
    return OPERATION_TYPE_CATEGORIES[operationType];
  }

  if (input.type === "income") return "Receitas";
  if (input.type === "investment") return "Investimento";
  return "Outros";
}
