const STORAGE_KEY = "garmonia_cabinet_auth_v1";

export type CabinetSessionPayload = {
  v: 1 | 2;
  token: string;
  expiresAt: string;
  verifiedAt?: string;
};

export type CabinetAuthStored =
  | { kind: "session"; token: string; expiresAt: string; verifiedAt: string | null }
  | { kind: "legacy" }
  | { kind: "none" };

export function parseCabinetAuthStored(): CabinetAuthStored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: "none" };
    if (raw === "1") return { kind: "legacy" };
    const o = JSON.parse(raw) as Partial<CabinetSessionPayload>;
    if ((o.v === 1 || o.v === 2) && typeof o.token === "string" && typeof o.expiresAt === "string") {
      return {
        kind: "session",
        token: o.token,
        expiresAt: o.expiresAt,
        verifiedAt: typeof o.verifiedAt === "string" ? o.verifiedAt : null,
      };
    }
    return { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}

export function saveCabinetSession(token: string, expiresAt: string): void {
  const p: CabinetSessionPayload = { v: 2, token, expiresAt, verifiedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function clearCabinetSessionStorage(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Совместимость со старыми клиентами без session token. */
export function saveCabinetLegacyAuthFlag(): void {
  window.localStorage.setItem(STORAGE_KEY, "1");
}

/** Старт приложения: считаем «в кабинете», если есть непросроченная сессия или старый флаг «1». */
export function initialCabinetAuthorizedFromStorage(): boolean {
  const s = parseCabinetAuthStored();
  if (s.kind === "none") return false;
  if (s.kind === "legacy") return true;
  return new Date(s.expiresAt).getTime() > Date.now();
}

export function hasEverCabinetVerification(): boolean {
  const s = parseCabinetAuthStored();
  return s.kind === "session" && !!s.verifiedAt;
}

export function isCabinetReauthRequired(maxHours: number): boolean {
  const s = parseCabinetAuthStored();
  if (s.kind !== "session") return true;
  if (new Date(s.expiresAt).getTime() <= Date.now()) return true;
  if (!s.verifiedAt) return true;
  const maxMs = maxHours * 60 * 60 * 1000;
  return Date.now() - new Date(s.verifiedAt).getTime() >= maxMs;
}

export async function validateCabinetSessionOnServer(apiBase: string, token: string): Promise<boolean> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/auth/cabinet/validate-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: token }),
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return data.ok === true;
}
