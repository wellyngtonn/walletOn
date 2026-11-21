// Mensagem amigável a partir de um erro desconhecido, com fallback padrão.
export function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
