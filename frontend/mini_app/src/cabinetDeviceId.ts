const STORAGE_KEY = "garmonia_cabinet_device_v1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

/** Стабильный UUID устройства/браузера для кабинета без Telegram (хранится в localStorage). */
export function getOrCreateCabinetDeviceId(): string {
  if (memoryId && UUID_RE.test(memoryId)) return memoryId;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) {
      memoryId = existing;
      return existing;
    }
    try {
      const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
      if (fromSession && UUID_RE.test(fromSession)) {
        window.localStorage.setItem(STORAGE_KEY, fromSession);
        memoryId = fromSession;
        return fromSession;
      }
    } catch {
      /* ignore */
    }
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    memoryId = id;
    return id;
  } catch {
    try {
      const existing = window.sessionStorage.getItem(STORAGE_KEY);
      if (existing && UUID_RE.test(existing)) {
        memoryId = existing;
        return existing;
      }
      const id = crypto.randomUUID();
      window.sessionStorage.setItem(STORAGE_KEY, id);
      memoryId = id;
      return id;
    } catch {
      const id = crypto.randomUUID();
      memoryId = id;
      return id;
    }
  }
}
