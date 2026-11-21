/**
 * Next/Vercel redireciona `/api/*` sem barra final com 308, e o preflight de
 * CORS do navegador não segue redirect. Normalizar a URL evita o "Failed to
 * fetch" em chamadas cross-origin (ex.: Firebase Hosting -> Vercel Function).
 */
export function withTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}
