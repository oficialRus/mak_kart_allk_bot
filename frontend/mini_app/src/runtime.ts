/**
 * Среда: Telegram WebApp vs браузер / PWA. Используйте вместо прямого доступа
 * к window.Telegram.WebApp там, где важен режим.
 *
 * PWA (в т.ч. service worker) — только вне Telegram WebView: в iOS встроенный
 * WebView + SW даёт неверный кэш. Регистрацию SW вызывать через
 * `shouldRegisterServiceWorker()` после подключения vite-plugin-pwa.
 */
const w = window as Window & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: { user?: { id?: number } };
      openLink?: (url: string) => void;
      openTelegramLink?: (url: string) => void;
    };
  };
};
const tg = w.Telegram?.WebApp;
const initData = tg?.initData;
const isTelegram =
  typeof initData === "string" && initData.length > 0;

function readStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

export const runtime = {
  isTelegram,
  initData: typeof initData === "string" ? initData : "",
  get telegramUserId() {
    const id = w.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
  },
  get isStandalone() {
    return readStandalone();
  },
  /**
   * Окружение, в котором допустимы PWA-фичи: установка, SW, отдельный app-shell.
   * В Telegram WebView — false, чтобы не регистрировать service worker.
   */
  isPwaEnvironment: !isTelegram,
} as const;

export function openExternalLink(url: string): void {
  try {
    if (runtime.isTelegram && w.Telegram?.WebApp?.openLink) {
      w.Telegram.WebApp.openLink(url);
      return;
    }
    window.open(url, "_blank");
  } catch {
    // ignore
  }
}

export function openTelegramLink(url: string): void {
  try {
    if (runtime.isTelegram && w.Telegram?.WebApp?.openTelegramLink) {
      w.Telegram.WebApp.openTelegramLink(url);
      return;
    }
    window.open(url, "_blank");
  } catch {
    // ignore
  }
}

/**
 * true — регистрировать service worker (только вне Telegram).
 * Для PWA-этапа: вызывать registerSW() из virtual:pwa-register только при true.
 */
export function shouldRegisterServiceWorker(): boolean {
  return !isTelegram;
}
