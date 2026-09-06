// Remove palavras de movimento que o extrato bancário inclui no nome, por
// exemplo "Pix enviado - ..." vira "Pix - ..." e "Pix recebido - ..." vira
// "Pix - ...".
const MOVEMENT_WORDS = /\s*(?:enviado|recebido)\s*/gi;

export function cleanTransactionName(name: string) {
  return name
    .replace(MOVEMENT_WORDS, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
