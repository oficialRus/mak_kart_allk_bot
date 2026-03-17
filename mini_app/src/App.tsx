import { useEffect, useState } from "react";
import { expandViewport, requestFullscreen } from "@telegram-apps/sdk";
import MainMenuScreen from "./screens/MainMenuScreen";
import CabinetMenuScreen from "./screens/CabinetMenuScreen";
import DailyNumberScreen from "./screens/DailyNumberScreen";
import MyReviewsScreen from "./screens/MyReviewsScreen";

const SECTOR_COUNT = 9;
const SECTOR_ANGLE = 360 / SECTOR_COUNT; // 40°
const SPIN_DURATION_MS = 4200;

function sanitizeFullNameInput(value: string): string {
  // Разрешаем только буквы (кириллица/латиница), пробелы и дефисы. Цифры и прочие символы вырезаем.
  return value.replace(/[^A-Za-zА-Яа-яЁё\s-]+/g, "");
}

function sanitizeBirthDateInput(value: string): string {
  // Оставляем только цифры.
  return value.replace(/\D+/g, "");
}

function formatBirthDateInput(raw: string): string {
  // Строим маску ДД.ММ.ГГГГ из последовательности цифр.
  const digits = raw.replace(/\D+/g, "").slice(0, 8);
  const len = digits.length;
  if (len <= 2) {
    return digits;
  }
  if (len <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function validateFullName(raw: string): { normalized?: string; error?: string } {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { error: "Введите имя" };
  }

  const parts = trimmed.split(" ").filter(Boolean);

  // Разрешаем только буквы (кириллица/латиница) и дефис в каждой части.
  const namePartRe = /^[A-Za-zА-ЯЁа-яё]+(?:-[A-Za-zА-ЯЁа-яё]+)?$/;
  if (!parts.every((p) => namePartRe.test(p))) {
    return {
      error: "Имя может содержать только буквы (кириллица или латиница) и дефис, без цифр и спецсимволов.",
    };
  }

  const normalized = parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (!lower) return "";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  return { normalized };
}

function validateBirthDate(raw: string): { normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Введите дату рождения" };
  }

  // Формат ДД.ММ.ГГГГ, только цифры и точки.
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (!match) {
    return { error: "Введите дату в формате ДД.ММ.ГГГГ, только цифры и точки." };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { error: "Некорректная дата рождения. Проверьте день и месяц." };
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { error: "Такой даты не существует. Проверьте правильность." };
  }

  const now = new Date();
  if (date > now) {
    return { error: "Дата рождения не может быть в будущем." };
  }
  if (year < 1900) {
    return { error: "Похоже на некорректный год рождения. Уточните, пожалуйста." };
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const normalized = `${dd}.${mm}.${year}`;

  return { normalized };
}

type Profile = {
  fullName: string;
  birthDate: string;
};

const STORAGE_KEY_PROFILE = "garmonia_compass_profile_v1";

const TECHNIQUES = [
  {
    id: 1,
    title: "Техника №1: «Я выбираю быть. Письмо себе из будущего»",
    text: `Техника №1: «Я выбираю быть. Письмо себе из будущего» с AR-визуализацией
1. Выберите карту, символизирующую ваше будущее «я». Если при взгляде на карту тревога выше 6 из 10, смените карту.
2. Запустите AR-ролик (1–3 минуты). Смотрите без анализа, воспринимайте как возможное будущее. Мотивационная озвучка — голос вашего будущего «я».
3. Закройте глаза, сделайте глубокий вдох и представьте себя через год. Ответьте на вопросы:
   • Что этот человек понял о себе?
   • От чего он отказался?
   • Как он поддерживает себя в трудные моменты?
4. Напишите письмо себе в будущее, укажите дату и положите в коробку на месяц.
5. Прочитайте письмо и выберите один маленький, выполнимый шаг.
6. Читайте письмо 3 раза в неделю в течение недели, внедряя изменения.
Повторяя практику, анализируйте, что изменилось, а что нет.`,
  },
  {
    id: 2,
    title: "Техника №2: «Путь принятия себя через образ»",
    text: `Техника №2: «Путь принятия себя через образ» с AR-визуализацией.
1. Выберите карту (открытую или закрытую) и внимательно изучите её посыл.
2. Оцените свои эмоции, посмотрев на карту. Позвольте себе почувствовать их.
3. Включите AR-ролик с мотивационной озвучкой. Представьте, как образ на карте появляется в реальной жизни.
4. Взаимодействуйте с образом как с вашим внутренним барьером. Представьте, как вы «удаляете» его и освобождаете себя.
5. Закройте глаза, сделайте вдох, почувствуйте момент.
6. Произнесите фразу: «Я выбираю быть…» и прочувствуйте её.
7. Повторите фразу 7 раз, усиливая уверенность.
8. Сделайте один маленький шаг в направлении, которое подсказывает карта.`,
  },
  {
    id: 3,
    title: "Техника №3: «Три карты дня»",
    text: `Техника №3: «Три карты дня»
1. Выберите первую карту «Настоящего» — как вы видите и ощущаете себя сейчас.
2. Выберите вторую карту «Прошлого» — прошлые достижения, страхи и уроки.
3. Выберите третью карту «Будущего» — кем вы хотите стать и какие изменения внести.
4. Запустите AR-визуализацию и понаблюдайте за образами.
5. Проанализируйте три карты вместе: повторяющиеся темы, контрасты, связи.
6. Возьмите карты с собой на день как напоминание о выбранном пути.`,
  },
  {
    id: 4,
    title: "Техника №4: «Внутренний диалог с критиком»",
    text: `Техника №4: «Внутренний диалог с критиком: голос выбора»
1. Выберите карту, вызывающую дискомфорт, и представьте, что это ваш внутренний критик.
2. Проанализируйте карту: что она символизирует для вас сейчас?
3. Запишите свои чувства и формулировку состояния.
4. Выберите вторую карту, символизирующую поддержку и уверенность.
5. Запустите AR-визуализацию, наблюдая, как образы оживают.
6. Спросите себя: «Как я могу больше доверять себе?»
7. Повторите мотивационные фразы 7 раз, ощущая, как уверенность растёт.
8. Запишите мысли и утверждения, которые помогут вам двигаться дальше.`,
  },
  {
    id: 5,
    title: "Техника №5: «День в гармонии»",
    text: `Техника №5: «День в гармонии»
1. Утром выберите одну карту интуитивно.
2. Посмотрите на изображение, отметьте чувства, эмоции, мысли.
3. Прочитайте название карты и свяжите его с образом.
4. Запишите ключевые осознания и один-два конкретных шага.
5. В течение дня реализуйте хотя бы один из шагов.`,
  },
  {
    id: 6,
    title: "Техника №6: «Вопрос–ответ»",
    text: `Техника №6: «Вопрос–ответ»
1. Чётко сформулируйте вопрос или запрос.
2. Перемешайте колоду и интуитивно выберите карту.
3. Изучите изображение и текст, отметьте эмоции и ассоциации.
4. Запустите AR-визуализацию и наблюдайте за образом.
5. Свяжите то, что видите, со своим вопросом: какие ответы или направления вам подсказывает карта?
6. Запишите выводы и один конкретный шаг, который готовы сделать.`,
  },
  {
    id: 7,
    title: "Техника №7: «Что скрывает взгляд»",
    text: `Техника №7: «Что скрывает взгляд»
1. Выберите несколько карт случайным образом.
2. Спокойно посмотрите на каждую карту, замечая, что первым привлекает внимание.
3. Запустите AR-визуализацию и наблюдайте, как оживают карты.
4. Отмечайте возникающие эмоции, образы, воспоминания.
5. Задавайте себе открытые вопросы по каждой карте: о чём это для меня сейчас?
6. Сделайте выводы и определите, какой шаг вы готовы сделать на основе увиденного.`,
  },
  {
    id: 8,
    title: "Техника №8: «Зеркало души»",
    text: `Техника №8: «Зеркало души»
1. Найдите спокойное место, сделайте несколько глубоких вдохов.
2. Перемешайте колоду и интуитивно выберите три карты.
3. Сосредоточьтесь на первой карте: какие эмоции и детали особенно заметны?
4. Перейдите ко второй карте: чем она дополняет или контрастирует с первой?
5. Изучите третью карту: какой новый ракурс она добавляет?
6. Запустите AR-визуализацию и наблюдайте образы.
7. Соедините три карты в единую историю о вашем текущем состоянии.
8. Запишите выводы и шаги, которые готовы предпринять.`,
  },
];

function hashStringToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  return positive % modulo;
}

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Внешнее золотое кольцо компаса
const OUTER_RING_R = 47.8;
const OUTER_RING_STROKE = 0.85;

// Палитра: тёмно-синие градиенты, очень низкий контраст (плавные переходы)
const SEGMENT_GRADIENTS = [
  { from: "#0d1629", to: "#0f182c" },
  { from: "#0c1528", to: "#0e172b" },
  { from: "#0d1629", to: "#0f182d" },
  { from: "#0b132b", to: "#0d1629" },
  { from: "#0c1528", to: "#0e172b" },
  { from: "#0c1428", to: "#0e172b" },
  { from: "#0b132b", to: "#0d1629" },
  { from: "#0d1629", to: "#0f182c" },
  { from: "#0c1529", to: "#0e172c" },
];

const NUMBER_COLOR = "#E8DCC0";
const ACCENT_GOLD = "#C9A96E";

// Мелкие тики компаса по внешнему кольцу (на границах секторов)
const TICK_INNER_R = 46.2;
const TICK_OUTER_R = 47.8;

export default function App() {
  const [rotation, setRotation] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<Profile>({
    fullName: "",
    birthDate: "",
  });
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof Profile, string>>>({});
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [dailyIndex, setDailyIndex] = useState<number | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [showBirthSpreadModal, setShowBirthSpreadModal] = useState(false);
  const [isClosingToCabinet, setIsClosingToCabinet] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showMainMenuScreen, setShowMainMenuScreen] = useState(false);
  const [showCabinetMenuScreen, setShowCabinetMenuScreen] = useState(false);
  const [showAiCoachScreen, setShowAiCoachScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "menu" | "cabinet">("daily");
  const [showTechniquesList, setShowTechniquesList] = useState(false);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<number | null>(null);
  const [dialogMessages, setDialogMessages] = useState<{ from: "user" | "ai"; text: string }[]>([]);
  const [dialogInput, setDialogInput] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogFromReview, setDialogFromReview] = useState(false);
  const [showDialogScreen, setShowDialogScreen] = useState(false);
  const [showCardDecodeScreen, setShowCardDecodeScreen] = useState(false);
  const [showCardDayScreen, setShowCardDayScreen] = useState(false);
  const [cardDay, setCardDay] = useState<{ title: string; description: string; imagePath?: string } | null>(null);
  const [cardDayLoading, setCardDayLoading] = useState(false);
  const [cardDayError, setCardDayError] = useState<string | null>(null);
  const [cardDayChosenToday, setCardDayChosenToday] = useState(false);
  const [cardDaySelectedIndex, setCardDaySelectedIndex] = useState<number | null>(null);
  const [cardDayHint, setCardDayHint] = useState<string | null>(null);
  const [cabinetProfile, setCabinetProfile] = useState<{ fullName: string; birthDate: string; phone?: string } | null>(null);
  const [cabinetProfileLoading, setCabinetProfileLoading] = useState(false);
  const [cabinetProfileError, setCabinetProfileError] = useState<string | null>(null);
  const [showMyReviewsScreen, setShowMyReviewsScreen] = useState(false);
  const [reviews, setReviews] = useState<{ id: number; mode: string; title: string; createdAt: string }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [initialScreen] = useState(() => {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get("screen") || "").toLowerCase();
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const w = window as unknown as {
      Telegram?: {
        WebApp?: {
          ready?: () => void;
          expand?: () => void;
          requestFullscreen?: () => void | Promise<unknown>;
          viewport?: { isExpanded?: boolean };
        };
      };
    };
    const webApp = w.Telegram?.WebApp;

    function doExpand() {
      try {
        webApp?.ready?.();
        if (webApp && !webApp.viewport?.isExpanded) webApp.expand?.();
        if (expandViewport.isAvailable()) expandViewport();
      } catch {
        // ignore
      }
    }
    function doFullscreen() {
      try {
        if (webApp?.requestFullscreen) (webApp.requestFullscreen as () => Promise<unknown>)?.();
        if (requestFullscreen.isAvailable()) requestFullscreen().catch(() => {});
      } catch {
        // ignore
      }
    }

    if (!webApp) {
      if (expandViewport.isAvailable()) expandViewport();
      if (requestFullscreen.isAvailable()) requestFullscreen().catch(() => {});
      return;
    }

    doExpand();
    doFullscreen();
    requestAnimationFrame(() => {
      doExpand();
      doFullscreen();
    });
    const t = window.setTimeout(() => {
      doExpand();
      doFullscreen();
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // Загружаем профиль из localStorage, если пользователь уже вводил данные.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Profile;
      if (!parsed.fullName || !parsed.birthDate) return;
      setProfile(parsed);
      setProfileForm(parsed);
      // При открытии с существующим профилем — сразу показываем главное меню,
      // и активной считаем вкладку «Меню».
      setShowMainMenuScreen(true);
      setActiveTab("menu");
    } catch {
      // ignore
    }
  }, []);

  // Если профиль уже есть и приложение открыто с параметром ?screen=main_menu,
  // сразу показываем главное меню внутри мини‑приложения.
  useEffect(() => {
    if (profile && initialScreen === "main_menu") {
      setShowMainMenuScreen(true);
      setActiveTab("menu");
      setShowCompass(false);
    }
  }, [profile, initialScreen]);

  // При наличии профиля запрашиваем "цифру дня" с бэкенда.
  // Если запрос недоступен (например, при локальной разработке без Telegram WebApp),
  // используем детерминированный локальный расчёт как запасной вариант.
  useEffect(() => {
    if (!profile) return;
    const w = window as unknown as {
      Telegram?: {
        WebApp?: {
          initData?: string;
        };
      };
    };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

    // Функция локального подсчёта "цифры дня" — как запасной вариант,
    // если нет initData или API недоступен.
    const computeFallbackIndex = () => {
      const todayKey = getTodayKey();
      const key = `${profile.fullName}|${profile.birthDate}|${todayKey}|${initData}`;
      const idx = hashStringToIndex(key, SECTOR_COUNT);
      setDailyIndex(idx);
      setWinningIndex(null);
      setHasResult(false);
      setDailyMessage(null);
    };

    // Если нет initData — используем локальный подсчёт.
    // Пустой apiBase допустим: тогда запрос уходит на относительный `/api/...`.
    if (!initData) {
      computeFallbackIndex();
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/daily-number`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok) {
          // Если по какой-то причине API не отвечает — не ломаем приложение.
          console.warn("daily-number API error:", res.status, await res.text());
          computeFallbackIndex();
          return;
        }
        const data = (await res.json()) as { index: number; num: number; message?: string };
        if (typeof data.index === "number" && data.index >= 0 && data.index < SECTOR_COUNT) {
          setDailyIndex(data.index);
          // Сбрасываем отображение результата до первого осознанного нажатия "Крутить".
          setWinningIndex(null);
          setHasResult(false);
          setDailyMessage(typeof data.message === "string" && data.message.trim() ? data.message.trim() : null);
        } else {
          computeFallbackIndex();
        }
      } catch (err) {
        console.warn("daily-number API request failed:", err);
        computeFallbackIndex();
      }
    })();
  }, [profile]);

  const handleProfileChange = (field: keyof Profile, value: string) => {
    let nextValue = value;
    if (field === "fullName") {
      nextValue = sanitizeFullNameInput(value);
    }
    if (field === "birthDate") {
      nextValue = formatBirthDateInput(value);
    }
    setProfileForm((prev) => ({ ...prev, [field]: nextValue }));
    setProfileErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleProfileSubmit = async (e: any) => {
    e.preventDefault();
    if (isProfileSubmitting) return;

    const errors: Partial<Record<keyof Profile, string>> = {};

    const fullNameCheck = validateFullName(profileForm.fullName);
    const birthDateCheck = validateBirthDate(profileForm.birthDate);

    if (fullNameCheck.error) {
      errors.fullName = fullNameCheck.error;
    }
    if (birthDateCheck.error) {
      errors.birthDate = birthDateCheck.error;
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setIsProfileSubmitting(true);
    const cleanProfile: Profile = {
      fullName: (fullNameCheck.normalized ?? profileForm.fullName.trim()).replace(/\s+/g, " "),
      birthDate: birthDateCheck.normalized ?? profileForm.birthDate.trim(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(cleanProfile));
    } catch {
      // ignore
    }
    // Отправка профиля на бэкенд (ФИО, дата рождения, Telegram ID из initData).
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    const initData = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";
    try {
      const res = await fetch(`${apiBase}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          fullName: cleanProfile.fullName,
          birthDate: cleanProfile.birthDate,
        }),
      });
      if (!res.ok) {
        console.warn("Profile API error:", res.status, await res.text());
      }
    } catch (e) {
      console.warn("Profile API request failed:", e);
    }
    setProfile(cleanProfile);
    setShowMainMenuScreen(true);
    setActiveTab("menu");
    setIsProfileSubmitting(false);
  };

  const handleResetProfile = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY_PROFILE);
    } catch {
      // ignore
    }
    setProfile(null);
    setProfileForm({
      fullName: "",
      birthDate: "",
    });
    setProfileErrors({});
    setDailyIndex(null);
    setWinningIndex(null);
    setHasResult(false);
    setDailyMessage(null);
    setRotation(0);
  };

  const resultNumber = winningIndex === null ? "-" : winningIndex + 1;
  const handleSpin = () => {
    if (isSpinning) {
      return;
    }

    if (profile == null || dailyIndex === null) {
      return;
    }

    setIsSpinning(true);
    setWinningIndex(null);

    // "Цифра дня" фиксирована для профиля и даты: крутим так, чтобы выбранный сектор dailyIndex оказался под указателем.
    const nextWinningIndex = dailyIndex;
    const segmentCenterDeg = -90 + (nextWinningIndex + 0.5) * SECTOR_ANGLE;
    const pointerAngle = 90;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const delta = segmentCenterDeg - pointerAngle - normalizedRotation;
    const targetOffset = ((delta % 360) + 360) % 360;
    const extraSpins = 5 + Math.floor(Math.random() * 2);
    const nextRotation = rotation + extraSpins * 360 + targetOffset;

    setRotation(nextRotation);

    window.setTimeout(() => {
      setWinningIndex(nextWinningIndex);
      setIsSpinning(false);
      setHasResult(true);
    }, SPIN_DURATION_MS);
  };

  const handleOpenCabinet = async () => {
    if (isClosingToCabinet) return;
    setIsClosingToCabinet(true);
    const w = window as unknown as {
      Telegram?: {
        WebApp?: {
          initData?: string;
          close?: () => void;
        };
      };
    };
    try {
      const initData = w.Telegram?.WebApp?.initData ?? "";
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
      if (initData) {
        await fetch(`${apiBase}/api/open-cabinet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
    try {
      w.Telegram?.WebApp?.close?.();
    } catch {
      // ignore
    }
    setIsClosingToCabinet(false);
  };

  const handleSaveDialog = async (mode: string) => {
    if (!dialogMessages.length) return;
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    try {
      await fetch(`${apiBase}/api/dialog-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          mode,
          title: "",
          messages: dialogMessages.map((m) => ({ from: m.from, text: m.text })),
        }),
      });
    } catch {
      // игнорируем ошибку сохранения, чтобы не блокировать UX
    }
  };

  const handleLoadReviews = async () => {
    setReviewsError(null);
    setReviewsLoading(true);
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    try {
      const res = await fetch(`${apiBase}/api/dialogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, limit: 50 }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setReviewsError(msg || "Не удалось получить список разборов.");
        return;
      }
      const data = (await res.json()) as { id: number; mode: string; title: string; createdAt: string }[] | null;
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviewsError("Произошла ошибка сети. Попробуйте ещё раз.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleOpenReview = async (id: number) => {
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    try {
      const url = new URL(`${apiBase}/api/dialog`, window.location.href);
      url.searchParams.set("id", String(id));
      url.searchParams.set("initData", initData);
      const res = await fetch(url.toString(), {
        method: "GET",
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        id: number;
        mode: string;
        title: string;
        createdAt: string;
        messages: { from: "user" | "ai"; text: string }[];
      };
      setDialogMessages(data.messages);
      setDialogError(null);
      setDialogInput("");
      setDialogFromReview(true);
      setShowMyReviewsScreen(false);
      setShowAiCoachScreen(true);
      setShowDialogScreen(true);
      setShowTechniquesList(false);
      setShowCardDecodeScreen(false);
      setShowCardDayScreen(false);
    } catch {
      // ignore
    }
  };

  const handleLoadCabinetProfile = async () => {
    setCabinetProfileError(null);
    setCabinetProfileLoading(true);
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    try {
      const res = await fetch(`${apiBase}/api/profile-get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setCabinetProfile(null);
          setCabinetProfileError("Профиль пока не заполнен.");
        } else {
          const msg = await res.text();
          setCabinetProfileError(msg || "Не удалось загрузить профиль.");
        }
        return;
      }
      const data = (await res.json()) as { fullName: string; birthDate: string; phone?: string };
      setCabinetProfile({
        fullName: data.fullName,
        birthDate: data.birthDate,
        phone: data.phone,
      });
    } catch {
      setCabinetProfileError("Произошла ошибка сети. Попробуйте ещё раз.");
    } finally {
      setCabinetProfileLoading(false);
    }
  };

  if (!profile) {
    return (
      <main className="page">
        <header className="app-header">
          <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>

        <div className="page-inner">
          <div className="page-main">
            <section className="roulette-card onboarding-card">
              <h1 className="onboarding-title">Познакомимся ближе</h1>
              <p className="onboarding-subtitle">Заполните данные, чтобы рассчитать вашу личную цифру дня.</p>
              <form className="onboarding-form" onSubmit={handleProfileSubmit}>
                <label className="onboarding-field">
                  <span className="onboarding-label">ФИО</span>
                  <input
                    type="text"
                    className={`onboarding-input ${profileErrors.fullName ? "has-error" : ""}`}
                    placeholder="Фамилия Имя Отчество"
                    value={profileForm.fullName}
                    onChange={(e) => handleProfileChange("fullName", e.target.value)}
                  />
                  {profileErrors.fullName && <span className="onboarding-error">{profileErrors.fullName}</span>}
                </label>

                <label className="onboarding-field">
                  <span className="onboarding-label">Дата рождения</span>
                  <input
                    type="text"
                    className={`onboarding-input ${profileErrors.birthDate ? "has-error" : ""}`}
                    placeholder="Например, 15.05.1990"
                    value={profileForm.birthDate}
                    onChange={(e) => handleProfileChange("birthDate", e.target.value)}
                  />
                  {profileErrors.birthDate && <span className="onboarding-error">{profileErrors.birthDate}</span>}
                </label>

                <button type="submit" className="spin-button" disabled={isProfileSubmitting}>
                  {isProfileSubmitting ? "Сохраняем..." : "Подтвердить и перейти к компасу"}
                </button>
              </form>
            </section>
          </div>

        </div>
      </main>
    );
  }

  if (showAiCoachScreen) {
    const selectedTechnique =
      selectedTechniqueId != null ? TECHNIQUES.find((t) => t.id === selectedTechniqueId) ?? null : null;

    return (
      <main className="page">
        <header className="app-header">
          <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>
        <div className="page-inner page-inner--blue">
          <div className="page-main">
            <section className="roulette-card onboarding-card">
              <h1 className="onboarding-title">ИИ‑Психолог Коуч</h1>
              {showTechniquesList ? (
                <>
                  <p className="onboarding-subtitle">Выберите технику, чтобы прочитать подробное описание.</p>
                  <div className="main-menu-list">
                    {TECHNIQUES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="main-menu-item"
                        onClick={() => setSelectedTechniqueId(t.id)}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                  {selectedTechnique && (
                    <div className="technique-text">
                      <h2 className="technique-title">{selectedTechnique.title}</h2>
                      <p className="technique-body">{selectedTechnique.text}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowTechniquesList(false);
                      setSelectedTechniqueId(null);
                    }}
                  >
                    ⬅️ Назад к режимам работы
                  </button>
                </>
              ) : showCardDecodeScreen ? (
                <>
                  <p className="onboarding-subtitle">
                    Этот режим помогает разбирать карту, которую вы видите перед собой.
                  </p>
                  <div className="technique-text">
                    <h2 className="technique-title">Как работать с расшифровкой карты</h2>
                    <p className="technique-body">
                      {`1. Возьмите карту (физическую или в телефоне) и несколько секунд просто посмотрите на неё.\n\n2. Обратите внимание на детали: цвета, образы, персонажей, то, что больше всего притягивает взгляд.\n\n3. Заметьте свои чувства и мысли: какие эмоции вызывает карта, с чем ассоциируется, какие воспоминания всплывают.\n\n4. Сформулируйте запрос: о чём именно вы хотите спросить карту? О ситуации, решении, отношении к себе, следующем шаге?`}
                    </p>
                    <p className="technique-body">
                      {`5. Когда будете готовы — нажмите кнопку ниже и опишите карту и ситуацию в диалоге с ИИ‑Психологом. Он поможет вам увидеть связи между образом карты и вашей жизнью, задать нужные вопросы и нащупать решения.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="spin-button"
                    onClick={() => {
                      setShowCardDecodeScreen(false);
                      setShowDialogScreen(true);
                      setDialogMessages([
                        {
                          from: "user",
                          text: "Хочу разобрать карту, которую сейчас вижу. Я опишу, что на ней изображено и что я чувствую, а вы помогите мне расшифровать её смысл.",
                        },
                      ]);
                      setDialogError(null);
                      setDialogInput("");
                      setDialogLoading(false);
                    }}
                  >
                    Перейти в диалог для расшифровки карты
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowCardDecodeScreen(false);
                    }}
                  >
                    ⬅️ Назад к режимам работы
                  </button>
                </>
              ) : showCardDayScreen ? (
                <>
                  <p className="onboarding-subtitle">
                    Здесь вы можете получить свою «карту дня» — короткое послание и подсказку на сегодня.
                  </p>
                  <div className="technique-text technique-text--card-day">
                    {cardDayLoading && <p className="technique-body">Подбираем карту дня…</p>}
                    {cardDayError && <p className="dialog-error">{cardDayError}</p>}
                    {!cardDayChosenToday && !cardDay && !cardDayLoading && !cardDayError && (
                      <>
                        <p className="technique-body">Выберите одну из 9 карт ниже. Остальные останутся закрытыми.</p>
                        <div className="card-day-grid">
                          {Array.from({ length: 9 }).map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className={`card-day-card ${cardDaySelectedIndex === idx ? "card-day-card--selected" : "card-day-card--closed"}`}
                              onClick={async () => {
                                if (cardDayChosenToday) {
                                  setCardDayHint("Сегодня вы уже выбрали свою карту дня. Остальные карты откроются завтра.");
                                  return;
                                }
                                setCardDaySelectedIndex(idx);
                                setCardDayLoading(true);
                                setCardDayError(null);
                                setCardDayHint(null);
                                try {
                                  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                                  const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                                  const initData = w.Telegram?.WebApp?.initData ?? "";
                                  const res = await fetch(`${apiBase}/api/card-day`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ initData }),
                                  });
                                  if (!res.ok) {
                                    const msg = await res.text();
                                    setCardDayError(msg || "Не удалось получить карту дня. Попробуйте позже.");
                                    return;
                                  }
                                  const data = (await res.json()) as { title: string; description: string; image_path?: string };
                                  setCardDay({
                                    title: data.title,
                                    description: data.description,
                                    imagePath: data.image_path,
                                  });
                                  setCardDayChosenToday(true);
                                  try {
                                    const todayKey = getTodayKey();
                                    window.localStorage.setItem("card_day_chosen_date", todayKey);
                                  } catch {
                                    // ignore
                                  }
                                } catch {
                                  setCardDayError("Произошла ошибка сети. Попробуйте ещё раз.");
                                } finally {
                                  setCardDayLoading(false);
                                }
                              }}
                            >
                              <span className="card-day-card-label">Карта {idx + 1}</span>
                            </button>
                          ))}
                        </div>
                        {cardDayHint && <p className="technique-body">{cardDayHint}</p>}
                      </>
                    )}
                    {cardDay && (
                      <>
                        <p className="technique-body">
                          Ваша карта дня на сегодня. Следующая карта станет доступна после 00:00 по московскому времени.
                        </p>
                        {cardDay.imagePath && (
                          <div className="card-day-image-wrapper">
                            <img src={cardDay.imagePath} alt={cardDay.title || "Карта дня"} className="card-day-image" />
                          </div>
                        )}
                        {cardDay.title && <h2 className="technique-title">{cardDay.title}</h2>}
                        {cardDay.description && (
                          <p className="technique-body">
                            {cardDay.description || "Описание карты пока не задано, но вы можете прислушаться к своим ассоциациям."}
                          </p>
                        )}
                        {!cardDay.description && (
                          <p className="technique-body">
                            {`Посмотрите на свою карту и отметьте:\n• какие детали привлекают внимание;\n• какие чувства и мысли появляются;\n• с какими ситуациями в вашей жизни это перекликается.`}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowCardDayScreen(false);
                    }}
                  >
                    ⬅️ Назад к режимам работы
                  </button>
                </>
              ) : showDialogScreen ? (
                <>
                  <p className="onboarding-subtitle">
                    Напишите, о чём хотите поговорить, и ИИ‑Психолог ответит вам в этом окне.
                  </p>
                  <div className="dialog-history">
                    {dialogMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={m.from === "user" ? "dialog-bubble dialog-bubble-user" : "dialog-bubble dialog-bubble-ai"}
                      >
                        {m.text}
                      </div>
                    ))}
                    {dialogLoading && <div className="dialog-bubble dialog-bubble-ai">Психолог набирает ответ…</div>}
                  </div>
                  {dialogError && <p className="dialog-error">{dialogError}</p>}
                  <form
                    className="dialog-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const text = dialogInput.trim();
                      if (!text || dialogLoading) return;
                      setDialogError(null);
                      setDialogLoading(true);
                      // Формируем историю для отправки на бэкенд:
                      // предыдущие сообщения + текущее пользовательское.
                      const historyForRequest = [
                        ...dialogMessages,
                        { from: "user" as const, text },
                      ];
                      setDialogMessages((prev) => [...prev, { from: "user", text }]);
                      setDialogInput("");

                      try {
                        const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                        const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                        const initData = w.Telegram?.WebApp?.initData ?? "";
                        const res = await fetch(`${apiBase}/api/ai-dialog`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            initData,
                            message: text,
                            history: historyForRequest.map((m) => ({
                              role: m.from === "user" ? "user" : "assistant",
                              content: m.text,
                            })),
                          }),
                        });
                        if (!res.ok) {
                          const msg = await res.text();
                          setDialogError(msg || "Не удалось получить ответ. Попробуйте ещё раз позже.");
                        } else {
                          const data = (await res.json()) as { reply: string };
                          setDialogMessages((prev) => [...prev, { from: "ai", text: data.reply }]);
                        }
                      } catch {
                        setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
                      } finally {
                        setDialogLoading(false);
                      }
                    }}
                  >
                    <textarea
                      className="dialog-input"
                      placeholder="Напишите свой вопрос или опишите ситуацию…"
                      rows={3}
                      value={dialogInput}
                      onChange={(e) => setDialogInput(e.target.value)}
                    />
                    <button type="submit" className="spin-button" disabled={dialogLoading || !dialogInput.trim()}>
                      {dialogLoading ? "Отправляем..." : "Отправить"}
                    </button>
                  </form>
                  <p className="onboarding-subtitle">
                    Чтобы сохранить этот разбор и увидеть его позже в разделе «Мои разборы», в конце нажмите кнопку
                    «Завершить диалог».
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      await handleSaveDialog("dialog");
                      setShowDialogScreen(false);
                      setDialogMessages([]);
                      setDialogError(null);
                      setDialogInput("");
                      setDialogLoading(false);
                    }}
                  >
                    🛑 Завершить диалог
                  </button>
                  {dialogFromReview && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        // Закрываем диалог и возвращаемся на экран "Мои разборы".
                        setShowDialogScreen(false);
                        setDialogFromReview(false);
                        setShowAiCoachScreen(false);
                        setShowMyReviewsScreen(true);
                      }}
                    >
                      ⬅️ Назад к списку разборов
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="onboarding-subtitle">Выберите формат работы, который вам нужен сейчас.</p>
                  <div className="main-menu-list">
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        setShowTechniquesList(true);
                        setSelectedTechniqueId(null);
                      }}
                    >
                      Техники
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        setShowCardDecodeScreen(true);
                        setShowDialogScreen(false);
                        setShowTechniquesList(false);
                        setSelectedTechniqueId(null);
                      }}
                    >
                      Расшифровка карты
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        setShowCardDayScreen(true);
                        setShowCardDecodeScreen(false);
                        setShowDialogScreen(false);
                        setShowTechniquesList(false);
                        setSelectedTechniqueId(null);
                        setCardDay(null);
                        setCardDayError(null);
                        setCardDayHint(null);
                        setCardDaySelectedIndex(null);
                        try {
                          const todayKey = getTodayKey();
                          const chosenDate = window.localStorage.getItem("card_day_chosen_date");
                          const alreadyChosen = chosenDate === todayKey;
                          setCardDayChosenToday(alreadyChosen);
                          const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                          const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                          const initData = w.Telegram?.WebApp?.initData ?? "";
                          if (alreadyChosen) {
                            setCardDayLoading(true);
                            (async () => {
                              try {
                                const res = await fetch(`${apiBase}/api/card-day`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ initData }),
                                });
                                if (!res.ok) {
                                  const msg = await res.text();
                                  setCardDayError(msg || "Не удалось получить карту дня. Попробуйте позже.");
                                  return;
                                }
                                const data = (await res.json()) as { title: string; description: string; image_path?: string };
                                setCardDay({
                                  title: data.title,
                                  description: data.description,
                                  imagePath: data.image_path,
                                });
                              } catch {
                                setCardDayError("Произошла ошибка сети. Попробуйте ещё раз.");
                              } finally {
                                setCardDayLoading(false);
                              }
                            })();
                          } else {
                            setCardDayLoading(false);
                          }
                        } catch {
                          setCardDayChosenToday(false);
                          setCardDayLoading(false);
                        }
                      }}
                    >
                      Карта дня
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        // Открываем диалог о раскладе по дате рождения.
                        setShowAiCoachScreen(false);
                        setShowCompass(true);
                        setShowMainMenuScreen(false);
                        setShowCabinetMenuScreen(false);
                        setActiveTab("daily");
                        setShowBirthSpreadModal(true);
                      }}
                    >
                      Получить расклад по дате рождения
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
          <nav className="bottom-nav">
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "daily" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowCompass(true);
                setShowMainMenuScreen(false);
                setShowCabinetMenuScreen(false);
                setActiveTab("daily");
              }}
            >
              Цифра дня
            </button>
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--menu ${activeTab === "menu" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowMainMenuScreen(true);
                setShowCabinetMenuScreen(false);
                setShowCompass(false);
                setActiveTab("menu");
              }}
            >
              Меню
            </button>
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "cabinet" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowCabinetMenuScreen(true);
                setShowMainMenuScreen(false);
                setShowCompass(false);
                setActiveTab("cabinet");
              }}
            >
              Личный кабинет
            </button>
          </nav>
        </div>
      </main>
    );
  }

  if (showMyReviewsScreen) {
    return (
      <MyReviewsScreen
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        onBack={() => {
          setShowMyReviewsScreen(false);
          setShowCabinetMenuScreen(true);
        }}
        onOpenReview={handleOpenReview}
      />
    );
  }

  if (showMainMenuScreen) {
    return (
      <MainMenuScreen
        onOpenDaily={() => {
          setShowMainMenuScreen(false);
          setShowCompass(true);
          setActiveTab("daily");
        }}
        onOpenAiCoach={() => {
          setShowMainMenuScreen(false);
          setShowAiCoachScreen(true);
          setActiveTab("menu");
        }}
        onOpenCabinet={() => {
          setShowMainMenuScreen(false);
          setShowCabinetMenuScreen(true);
          setActiveTab("cabinet");
        }}
        onOpenDigitalPsychologist={() => {
          setShowMainMenuScreen(false);
          setShowAiCoachScreen(true);
          setShowTechniquesList(false);
          setSelectedTechniqueId(null);
          setShowDialogScreen(true);
          setDialogMessages([]);
          setDialogError(null);
          setDialogInput("");
          setDialogLoading(false);
        }}
        activeTab={activeTab}
      />
    );
  }

  if (showCabinetMenuScreen) {
    return (
      <CabinetMenuScreen
        onOpenDaily={() => {
          setShowCabinetMenuScreen(false);
          setShowCompass(true);
          setActiveTab("daily");
        }}
        onOpenMenu={() => {
          setShowCabinetMenuScreen(false);
          setShowMainMenuScreen(true);
          setActiveTab("menu");
        }}
        onShowMyData={handleLoadCabinetProfile}
        myData={cabinetProfile}
        myDataLoading={cabinetProfileLoading}
        myDataError={cabinetProfileError}
        onOpenMyReviews={() => {
          setShowCabinetMenuScreen(false);
          setShowMyReviewsScreen(true);
          void handleLoadReviews();
        }}
        activeTab={activeTab}
      />
    );
  }

  return (
    <DailyNumberScreen
      showCompass={showCompass}
      rotation={rotation}
      isSpinning={isSpinning}
      hasResult={hasResult}
      resultNumber={resultNumber}
      dailyMessage={dailyMessage}
      showBirthSpreadModal={showBirthSpreadModal}
      onSpin={handleSpin}
      onResetProfile={handleResetProfile}
      onOpenMenu={() => {
        setShowMainMenuScreen(true);
        setActiveTab("menu");
      }}
      onOpenCabinet={() => {
        setShowMainMenuScreen(false);
        setShowCabinetMenuScreen(true);
        setActiveTab("cabinet");
      }}
      onOpenBirthSpreadModal={() => setShowBirthSpreadModal(true)}
      onCloseBirthSpreadModal={() => setShowBirthSpreadModal(false)}
      onOpenCabinetFromModal={handleOpenCabinet}
      activeTab={activeTab}
    />
  );
}
