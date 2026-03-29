const STORAGE_KEY = "garmonia_cabinet_auth_v1";

export type CabinetSessionPayload = { v: 1; token: string; expiresAt: string };

export type CabinetAuthStored =
  | { kind: "session"; token: string; expiresAt: string }
  | { kind: "legacy" }
  | { kind: "none" };

export function parseCabinetAuthStored(): CabinetAuthStored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: "none" };
    if (raw === "1") return { kind: "legacy" };
    const o = JSON.parse(raw) as Partial<CabinetSessionPayload>;
    if (o.v === 1 && typeof o.token === "string" && typeof o.expiresAt === "string") {
      return { kind: "session", token: o.token, expiresAt: o.expiresAt };
    }
    return { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}

export function saveCabinetSession(token: string, expiresAt: string): void {
  const p: CabinetSessionPayload = { v: 1, token, expiresAt };
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
