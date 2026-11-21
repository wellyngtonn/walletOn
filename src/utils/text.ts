// Remove acentos, converte para minúsculas e limpa espaços das bordas.
// Usado para comparar textos vindos de fontes externas (Pierre, produtos).
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
