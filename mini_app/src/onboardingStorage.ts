/** Версия ключа — при смене сценария онбординга можно увеличить и показать снова. */
const STORAGE_PREFIX = "garmonia_onboarding_done_v1";

export function getTelegramUserId(): number | null {
  try {
    const w = window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } };
    };
    const id = w.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
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
