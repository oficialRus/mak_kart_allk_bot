/** Версия ключа — при смене сценария онбординга можно увеличить и показать снова. */
import { runtime } from "./runtime";

const STORAGE_PREFIX = "garmonia_onboarding_done_v1";

export function getTelegramUserId(): number | null {
  return runtime.telegramUserId;
}

function storageKey(telegramUserId: number): string {
  return `${STORAGE_PREFIX}:${telegramUserId}`;
}

/**
 * true, если пользователь Telegram ещё ни разу не завершил онбординг на этом устройстве.
 * Без Telegram (локальная отладка) — false, онбординг не показываем.
 */
export function isFirstLaunch(): boolean {
  const id = getTelegramUserId();
  if (id == null) {
    return false;
  }
  try {
    return window.localStorage.getItem(storageKey(id)) !== "1";
  } catch {
    return false;
  }
}

/** Вызывать после «Пропустить» или финиша слайдов. */
export function markOnboardingComplete(): void {
  const id = getTelegramUserId();
  if (id == null) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(id), "1");
  } catch {
    // quota / private mode — онбординг может снова появиться; это редкий кейс
  }
}
