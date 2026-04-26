import { parseCabinetAuthStored } from "../cabinetSession";
import { runtime } from "../runtime";

type ApiCallOptions = {
  method?: "GET" | "POST";
  signal?: AbortSignal;
  includeInitDataFallback?: boolean;
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
}

function getInitData(): string {
  return runtime.initData ?? "";
}

function getBearerToken(): string | null {
  const session = parseCabinetAuthStored();
  if (session.kind !== "session") return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session.token;
}

function cookieAuthEnabled(): boolean {
  const v = (import.meta.env.VITE_AUTH_USE_HTTPONLY_COOKIE ?? "").toString().trim().toLowerCase();
  return v === "1" || v === "true";
}

function readCookie(name: string): string {
  const pref = `${name}=`;
  const part = document.cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(pref));
  return part ? decodeURIComponent(part.slice(pref.length)) : "";
}

export async function apiCall(path: string, body: Record<string, unknown> = {}, options: ApiCallOptions = {}): Promise<Response> {
  const method = options.method ?? "POST";
  const token = getBearerToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (cookieAuthEnabled()) {
    const csrf = readCookie("cabinet_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const base = apiBase();
  if (method === "GET") {
    const url = new URL(`${base}${path}`, window.location.href);
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
    if (!token && (options.includeInitDataFallback ?? true) && runtime.isTelegram && getInitData()) {
      url.searchParams.set("initData", getInitData());
    }
    return fetch(url.toString(), { method: "GET", headers, signal: options.signal, credentials: cookieAuthEnabled() ? "include" : "same-origin" });
  }

  const payload = { ...body };
  if (!token && (options.includeInitDataFallback ?? true) && runtime.isTelegram && getInitData() && !("initData" in payload)) {
    payload.initData = getInitData();
  }
  return fetch(`${base}${path}`, {
    method,
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
    credentials: cookieAuthEnabled() ? "include" : "same-origin",
  });
}
