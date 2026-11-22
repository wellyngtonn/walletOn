// Remove palavras de movimento que o extrato bancário inclui no nome, por
// exemplo "Pix enviado - ..." vira "Pix - ..." e "Pix recebido - ..." vira
// "Pix - ...".
const MOVEMENT_WORDS =
  /\b(pix|transfer[eê]ncia)\s+(?:enviad[oa]s?|recebid[oa]s?)\b/gi;

const MC_DATE = /\s*\bMC\s*\d{2}\/\d{2}(?:\/\d{2,4})?\s*/gi;

const CARD_PURCHASES: Array<[RegExp, string]> = [
  [/\bcompra\s+cart[aã]o(?:\s+de)?\s+d[eé]b(?:ito)?\b/gi, "CCD"],
  [/\bcompra\s+cart[aã]o(?:\s+de)?\s+cr[eé]d(?:ito)?\b/gi, "CCC"],
];

const KEEP_UPPERCASE = new Set([
  "ATM",
  "BB",
  "CCC",
  "CCD",
  "CNPJ",
  "CPF",
  "DOC",
  "EIRELI",
  "EPP",
  "IOF",
  "LTDA",
  "ME",
  "MEI",
  "SA",
  "TED",
]);

const LOWERCASE_WORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
]);

function isUpperCaseText(value: string) {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return (
    letters.length > 0 &&
    letters === letters.toUpperCase() &&
    letters !== letters.toLowerCase()
  );
}

function formatWord(word: string, index: number) {
  if (!isUpperCaseText(word)) return word;

  const bare = word.replace(/[^\p{L}]/gu, "");
  if (!bare) return word;
  if (KEEP_UPPERCASE.has(bare)) return word;
  if (index > 0 && LOWERCASE_WORDS.has(bare.toLowerCase())) {
    return word.toLocaleLowerCase("pt-BR");
  }

  const lower = word.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

export function cleanTransactionName(name: string) {
  const cleaned = name
    .replace(MOVEMENT_WORDS, "$1")
    .replace(MC_DATE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const formatted = cleaned
    .split(" ")
    .map((word, index) => formatWord(word, index))
    .join(" ");

  return CARD_PURCHASES.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    formatted,
  );
}
