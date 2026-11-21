import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { IncomingMessage, ServerResponse } from "node:http";

export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};

const DEFAULT_ALLOWED_ORIGINS = [
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

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais administrativas do Firebase não estão configuradas na Vercel.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function firestore() {
  return getFirestore(adminApp());
}

export async function verifyFirebaseToken(token: string) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey)
    throw new Error("FIREBASE_WEB_API_KEY não está configurada na Vercel.");
  const result = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!result.ok)
    throw Object.assign(new Error("Token Firebase inválido."), { status: 401 });
  const body = (await result.json()) as {
    users?: Array<{ localId?: string }>;
  };
  const uid = body.users?.[0]?.localId;
  if (!uid)
    throw Object.assign(new Error("Token Firebase sem usuário."), {
      status: 401,
    });
  return uid;
}

export function bearerToken(request: ApiRequest) {
  const authorization = request.headers.authorization;
  return typeof authorization === "string"
    ? authorization.replace(/^Bearer\s+/i, "").trim()
    : "";
}

export function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}

export function parseAmount(raw: unknown) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let value = String(raw ?? "")
    .replace(/\s/g, "")
    .replace(/^R\$/i, "");
  if (value.includes(",") && value.includes(".")) {
    value =
      value.lastIndexOf(",") > value.lastIndexOf(".")
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function syncPeriod(body: Record<string, unknown>) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const ago = new Date(now);
  ago.setFullYear(now.getFullYear() - 1);
  const from =
    typeof body.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fromDate)
      ? body.fromDate
      : ago.toISOString().slice(0, 10);
  const to =
    typeof body.toDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.toDate)
      ? body.toDate
      : today;
  if (!validDate(from) || !validDate(to) || from > to) {
    throw new ApiError("Período inválido.", 400);
  }
  return { from, to };
}

export function preferredAccountId(body: Record<string, unknown>) {
  return typeof body.preferredAccountId === "string"
    ? body.preferredAccountId
    : null;
}

export function userReference(uid: string) {
  return firestore().collection("users").doc(uid);
}

export function setCors(response: ApiResponse, requestOrigin?: string) {
  const configuredOrigins = (process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    ...configuredOrigins,
    ...DEFAULT_ALLOWED_ORIGINS,
  ]);
  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
  } else if (!requestOrigin && !configuredOrigins.length) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Vary", "Origin");
}

export function errorStatus(error: unknown) {
  const status = Number((error as { status?: unknown })?.status);
  if (status === 400) return 400;
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 408 || status === 429 || status >= 500) return 503;
  if (status === 412) return 412;
  return 500;
}
