import type { IncomingMessage, ServerResponse } from "node:http";
import { cosmosProductName, upcProductName, validBarcode } from "../src/utils/shopping-product.js";

type Request = IncomingMessage & { body?: { barcode?: unknown } };
type Response = ServerResponse & { status: (code: number) => Response; json: (body: unknown) => void };
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
    if (!auth.ok || !(await auth.json()).users?.[0]?.localId) return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    const apiToken = process.env.COSMOS_API_TOKEN;
    const userAgent = process.env.COSMOS_USER_AGENT;
    const cached = cache.get(code);
    if (cached && cached.expires > Date.now()) return res.status(200).json({ name: cached.name, source: cached.source });
    let upcFailed = false;
    try {
      const upc = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000),
      });
      if (upc.ok) {
        const name = upcProductName(await upc.json(), code);
        if (name) {
          if (cache.size >= 1000) cache.clear();
          cache.set(code, { name, source: "upcitemdb", expires: Date.now() + 24 * 60 * 60 * 1000 });
          return res.status(200).json({ name, source: "upcitemdb" });
        }
      } else upcFailed = upc.status !== 404;
    } catch { upcFailed = true; }
    if (!apiToken || !userAgent) return res.status(upcFailed ? 502 : 404).json({
      error: upcFailed ? "Consulta de produtos indisponível ou com limite atingido." : "Produto não encontrado.",
    });
    const result = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${code}.json`, {
      headers: { "X-Cosmos-Token": apiToken, "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (result.status === 404) return res.status(404).json({ error: "Produto não encontrado." });
    if (result.status === 429) return res.status(429).json({ error: "Limite diário da consulta brasileira atingido." });
    if (!result.ok) return res.status(502).json({ error: "Consulta brasileira indisponível." });
    const name = cosmosProductName(await result.json(), code);
    if (!name) return res.status(404).json({ error: "Produto sem descrição." });
    if (cache.size >= 1000) cache.clear();
    cache.set(code, { name, source: "cosmos", expires: Date.now() + 24 * 60 * 60 * 1000 });
    return res.status(200).json({ name, source: "cosmos" });
  } catch {
    return res.status(502).json({ error: "Consulta brasileira indisponível. Tente novamente." });
  }
}
