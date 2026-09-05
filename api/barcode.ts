import type { IncomingMessage, ServerResponse } from "node:http";
import {
  cosmosProductName,
  shoppingProductName,
  upcProductName,
  validBarcode,
} from "../src/utils/shopping-product.js";

type Request = IncomingMessage & { body?: { barcode?: unknown } };
type Response = ServerResponse & { status: (code: number) => Response; json: (body: unknown) => void };
type Attempt = { name: string; clean: boolean; limited?: boolean };
const cache = new Map<string, { name: string; source: string; expires: number }>();
const defaultOrigins = [
  "https://setenta.web.app",
  "https://setenta.firebaseapp.com",
  "https://wallet-on-c0b05.web.app",
  "https://wallet-on-c0b05.firebaseapp.com",
  "https://wallet-on.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://172.22.192.1:3001",
];

async function attemptOpenFoodFacts(code: string): Promise<Attempt> {
  try {
    const url = "https://world.openfoodfacts.org/api/v2/product/" +
      `${code}?fields=product_name,product_name_pt,abbreviated_product_name,brands,quantity,product_quantity,product_quantity_unit`;
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (response.status === 404) return { name: "", clean: true };
    if (!response.ok) return { name: "", clean: false };
    const data: { product?: Record<string, unknown> | null } | null = await response.json().catch(() => null);
    const product = data?.product;
    const name = product ? shoppingProductName(product as never, code) : "";
    return { name, clean: true };
  } catch {
    return { name: "", clean: false };
  }
}

async function attemptCosmos(code: string, apiToken: string, userAgent: string): Promise<Attempt> {
  if (!apiToken || !userAgent) return { name: "", clean: true };
  try {
    const result = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${code}.json`, {
      headers: { "X-Cosmos-Token": apiToken, "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (result.status === 404) return { name: "", clean: true };
    if (result.status === 429) return { name: "", clean: false, limited: true };
    if (!result.ok) return { name: "", clean: false };
    const name = cosmosProductName(await result.json() as never, code);
    return { name, clean: true };
  } catch {
    return { name: "", clean: false };
  }
}

async function attemptUpcitemdb(code: string): Promise<Attempt> {
  try {
    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000),
    });
    if (response.status === 404) return { name: "", clean: true };
    if (!response.ok) return { name: "", clean: false };
    const name = upcProductName(await response.json() as never, code);
    return { name, clean: true };
  } catch {
    return { name: "", clean: false };
  }
}

function remember(res: Response, code: string, name: string, source: string) {
  if (cache.size >= 1000) cache.clear();
  cache.set(code, { name, source, expires: Date.now() + 24 * 60 * 60 * 1000 });
  return res.status(200).json({ name, source });
}

export default async function handler(req: Request, res: Response) {
  const origin = req.headers.origin;
  const allowed = new Set(
    (process.env.ALLOWED_ORIGIN || defaultOrigins.join(",")).split(",").map((value) => value.trim()).filter(Boolean),
  );
  if (origin && allowed.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Faça login para consultar produtos." });
  const code = req.body?.barcode;
  if (typeof code !== "string" || !validBarcode(code)) return res.status(400).json({ error: "Código de barras inválido." });
  const firebaseKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseKey) return res.status(503).json({ error: "Consulta de produtos ainda não configurada." });
  try {
    const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(5000),
    });
    if (!auth.ok || !(await auth.json() as { users?: Array<{ localId?: string }> }).users?.[0]?.localId) {
      return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    }
    const cached = cache.get(code);
    if (cached && cached.expires > Date.now()) return res.status(200).json({ name: cached.name, source: cached.source });

    const cosmosToken = process.env.COSMOS_API_TOKEN || "";
    const cosmosAgent = process.env.COSMOS_USER_AGENT || "";
    let name = "";
    let source = "";
    let clean = true;
    let limited = false;

    // Open Food Facts primeiro: gratuito, sem chave e com boa cobertura brasileira.
    let attempt = await attemptOpenFoodFacts(code);
    if (attempt.name) { name = attempt.name; source = "openfoodfacts"; } else { clean = clean && attempt.clean; }

    // Cosmos é opcional: só é consultado se configurado.
    if (!name) {
      attempt = await attemptCosmos(code, cosmosToken, cosmosAgent);
      if (attempt.name) { name = attempt.name; source = "cosmos"; } else {
        clean = clean && attempt.clean;
        limited = limited || attempt.limited === true;
      }
    }

    // UPCitemdb por último para não gastar a cota diária (100/dia) à toa.
    if (!name) {
      attempt = await attemptUpcitemdb(code);
      if (attempt.name) { name = attempt.name; source = "upcitemdb"; } else { clean = clean && attempt.clean; }
    }

    if (name) return remember(res, code, name, source);
    if (limited) return res.status(429).json({ error: "Limite diário da consulta atingido. Tente novamente amanhã." });
    if (!clean) return res.status(502).json({ error: "Consulta de produtos indisponível. Tente novamente." });
    return res.status(404).json({ error: "Produto não encontrado." });
  } catch {
    return res.status(502).json({ error: "Consulta de produtos indisponível. Tente novamente." });
  }
}
