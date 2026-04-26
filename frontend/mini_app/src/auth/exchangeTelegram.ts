import { saveCabinetSession } from "../cabinetSession";
import { runtime } from "../runtime";
import { apiCall } from "../shared/api";

type ExchangeResponse = {
  ok?: boolean;
  sessionToken?: string;
  sessionExpiresAt?: string;
};

export async function exchangeTelegramToSessionIfNeeded(): Promise<boolean> {
  if (!runtime.isTelegram || !runtime.initData) return false;
  const res = await apiCall("/api/auth/telegram", { initData: runtime.initData }, { includeInitDataFallback: false });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as ExchangeResponse;
  if (typeof data.sessionToken === "string" && typeof data.sessionExpiresAt === "string") {
    saveCabinetSession(data.sessionToken, data.sessionExpiresAt);
    return true;
  }
  return false;
}
