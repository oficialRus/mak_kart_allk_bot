import { useEffect, useState } from "react";
import { expandViewport, requestFullscreen } from "@telegram-apps/sdk";

const SECTOR_COUNT = 9;
const SECTOR_ANGLE = 360 / SECTOR_COUNT; // 40°
const SPIN_DURATION_MS = 4200;
const NUMBERS = Array.from({ length: SECTOR_COUNT }, (_, index) => index + 1);

// Геометрия компаса (полярная система)
const CX = 50;
const CY = 50;
const RIM_OUTER_R = 48;
const WHEEL_OUTER_R = RIM_OUTER_R;
const RIM_INNER_R = 42;
const INNER_RING_R = 20; // тонкое кольцо вокруг центра
const CENTER_CORE_RING_R = 11;
const NUMBER_RADIUS = 26; // числа чуть ближе к центру
const SEGMENT_BORDER_STROKE = 0.35;
const toRad = (deg: number) => (deg * Math.PI) / 180;

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

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function segmentPath(i: number): string {
  const startDeg = -90 + i * SECTOR_ANGLE;
  const endDeg = -90 + (i + 1) * SECTOR_ANGLE;
  const outerStart = polar(CX, CY, WHEEL_OUTER_R, startDeg);
  const outerEnd = polar(CX, CY, WHEEL_OUTER_R, endDeg);
  return `M ${CX} ${CY} L ${outerStart.x} ${outerStart.y} A ${WHEEL_OUTER_R} ${WHEEL_OUTER_R} 0 0 1 ${outerEnd.x} ${outerEnd.y} L ${CX} ${CY} Z`;
}

function numberPosition(i: number, r: number) {
  const deg = -90 + (i + 0.5) * SECTOR_ANGLE;
  return polar(CX, CY, r, deg);
}

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
  const [showTechniquesList, setShowTechniquesList] = useState(false);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<number | null>(null);
  const [dialogMessages, setDialogMessages] = useState<{ from: "user" | "ai"; text: string }[]>([]);
  const [dialogInput, setDialogInput] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [showDialogScreen, setShowDialogScreen] = useState(false);
  const [showCardDecodeScreen, setShowCardDecodeScreen] = useState(false);
  const [showCardDayScreen, setShowCardDayScreen] = useState(false);
  const [cardDay, setCardDay] = useState<{ title: string; description: string } | null>(null);
  const [cardDayLoading, setCardDayLoading] = useState(false);
  const [cardDayError, setCardDayError] = useState<string | null>(null);

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
      // При открытии с существующим профилем — сразу показываем главное меню.
      setShowMainMenuScreen(true);
    } catch {
      // ignore
    }
  }, []);

  // Если профиль уже есть и приложение открыто с параметром ?screen=main_menu,
  // сразу показываем главное меню внутри мини‑приложения.
  useEffect(() => {
    if (profile && initialScreen === "main_menu") {
      setShowMainMenuScreen(true);
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

  const resultNumber = winningIndex === null ? "-" : NUMBERS[winningIndex];
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
                  <div className="technique-text">
                    {cardDayLoading && <p className="technique-body">Подбираем карту дня…</p>}
                    {cardDayError && <p className="dialog-error">{cardDayError}</p>}
                    {cardDay && (
                      <>
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
                    {!cardDayLoading && !cardDayError && !cardDay && (
                      <p className="technique-body">
                        Карта дня пока недоступна. Попробуйте ещё раз позже или обратитесь к ИИ‑Психологу в диалоге.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="spin-button"
                    onClick={() => {
                      setShowCardDayScreen(false);
                      setShowDialogScreen(true);
                      const intro =
                        "Я только что получил(а) карту дня в приложении. Помогите, пожалуйста, разобрать её послание и связать с моей ситуацией.";
                      setDialogMessages((prev) =>
                        prev.length > 0 ? prev : [{ from: "user", text: intro }],
                      );
                      setDialogError(null);
                      setDialogInput("");
                      setDialogLoading(false);
                    }}
                  >
                    Обсудить карту дня с ИИ
                  </button>
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
                      setDialogMessages((prev) => [...prev, { from: "user", text }]);
                      setDialogInput("");

                      try {
                        const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                        const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                        const initData = w.Telegram?.WebApp?.initData ?? "";
                        const res = await fetch(`${apiBase}/api/ai-dialog`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ initData, message: text }),
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
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowDialogScreen(false);
                      setDialogMessages([]);
                      setDialogError(null);
                      setDialogInput("");
                      setDialogLoading(false);
                    }}
                  >
                    🛑 Завершить диалог
                  </button>
                </>
              ) : (
                <>
                  <p className="onboarding-subtitle">Выберите формат работы, который вам нужен сейчас.</p>
                  <div className="main-menu-list">
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        setShowTechniquesList(false);
                        setSelectedTechniqueId(null);
                        setShowDialogScreen(true);
                        setDialogMessages([]);
                        setDialogError(null);
                        setDialogInput("");
                        setDialogLoading(false);
                      }}
                    >
                      Диалог
                    </button>
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
                        setCardDayLoading(true);

                        (async () => {
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
                            } else {
                              const data = (await res.json()) as { title: string; description: string };
                              setCardDay({
                                title: data.title,
                                description: data.description,
                              });
                            }
                          } catch {
                            setCardDayError("Произошла ошибка сети. Попробуйте ещё раз.");
                          } finally {
                            setCardDayLoading(false);
                          }
                        })();
                      }}
                    >
                      Карта дня
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        // позже можно связать с раскладом по дате рождения
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
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowCompass(true);
              }}
            >
              Цифра дня
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--menu"
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowMainMenuScreen(true);
              }}
            >
              Меню
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                setShowAiCoachScreen(false);
                setShowCabinetMenuScreen(true);
              }}
            >
              Личный кабинет
            </button>
          </nav>
        </div>
      </main>
    );
  }

  if (showMainMenuScreen) {
    return (
      <main className="page">
        <header className="app-header">
          <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>
        <div className="page-inner page-inner--blue">
          <div className="page-main">
            <section className="roulette-card onboarding-card">
              <h1 className="onboarding-title">Меню</h1>
              <p className="onboarding-subtitle">Выберите раздел, с которого хотите начать.</p>
              <div className="main-menu-list">
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    setShowMainMenuScreen(false);
                    setShowAiCoachScreen(true);
                  }}
                >
                  ИИ‑Психолог Коуч
                </button>
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    setShowMainMenuScreen(false);
                    setShowCompass(false);
                  }}
                >
                  Обучение
                </button>
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    setShowMainMenuScreen(false);
                    setShowCompass(false);
                  }}
                >
                  Магазин
                </button>
              </div>
            </section>
          </div>
          <nav className="bottom-nav">
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                setShowMainMenuScreen(false);
                setShowCompass(true);
              }}
            >
              Цифра дня
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--menu"
              onClick={() => {
                // уже на главном меню — ничего не делаем
              }}
            >
              Меню
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                setShowMainMenuScreen(false);
                setShowCabinetMenuScreen(true);
              }}
            >
              Личный кабинет
            </button>
          </nav>
        </div>
      </main>
    );
  }

  if (showCabinetMenuScreen) {
    return (
      <main className="page">
        <header className="app-header">
          <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>
        <div className="page-inner page-inner--blue">
          <div className="page-main">
            <section className="roulette-card onboarding-card">
              <h1 className="onboarding-title">Личный кабинет</h1>
              <p className="onboarding-subtitle">Что вы хотите открыть сейчас?</p>
              <div className="main-menu-list">
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    // Мои данные — пока просто остаёмся в приложении.
                  }}
                >
                  Мои данные
                </button>
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    // Мои разборы — заглушка, можно позже связать с ботом.
                  }}
                >
                  Мои разборы
                </button>
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    // Цифровой психолог — пока без отдельного экрана в мини‑приложении.
                  }}
                >
                  Цифровой психолог
                </button>
                <button
                  type="button"
                  className="main-menu-item"
                  onClick={() => {
                    // Обучение — также можно будет связать с ботом.
                  }}
                >
                  Обучение
                </button>
              </div>
            </section>
          </div>
          <nav className="bottom-nav">
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                setShowCabinetMenuScreen(false);
                setShowCompass(true);
              }}
            >
              Цифра дня
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--menu"
              onClick={() => {
                setShowCabinetMenuScreen(false);
                setShowMainMenuScreen(true);
              }}
            >
              Меню
            </button>
            <button
              type="button"
              className="bottom-nav-button bottom-nav-button--primary"
              onClick={() => {
                // Уже на экране личного кабинета.
              }}
            >
              Личный кабинет
            </button>
          </nav>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="app-header">
        <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>

      <div className="page-inner">
        <div className="page-main">
          {showCompass && (
            <section className="roulette-card">
              <p className="compass-promo">
                Нажми «Крутить» — и узнай свою цифру дня
              </p>
              <div className="wheel-area">
                <div className="pointer" aria-hidden="true" />

                <div className="wheel-shell">
                  <div className={`wheel-outer ${isSpinning ? "is-spinning" : ""}`}>
                    <div
                      className="wheel"
                      style={
                        {
                          "--rotation": `${rotation}deg`,
                        } as React.CSSProperties
                      }
                      aria-label="Рулетка с девятью сегментами"
                    >
                      <svg
                        className="wheel-svg"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="xMidYMid meet"
                        aria-label="Компас цифровой психологии — девять направлений"
                      >
                <defs>
                  {/* Градиенты секторов (тёмно-синие, плавные) */}
                  {SEGMENT_GRADIENTS.map((g, i) => {
                    const end = polar(50, 50, 50, -90 + (i + 0.5) * SECTOR_ANGLE);
                    return (
                      <linearGradient
                        key={i}
                        id={`segmentGrad-${i}`}
                        x1="50"
                        y1="50"
                        x2={String(end.x)}
                        y2={String(end.y)}
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop offset="0%" stopColor={g.from} />
                        <stop offset="100%" stopColor={g.to} />
                      </linearGradient>
                    );
                  })}
                  {/* Мягкое свечение центра — премиальное медитативное ощущение */}
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E8DCC0" stopOpacity="0.85" />
                    <stop offset="28%" stopColor={ACCENT_GOLD} stopOpacity="0.4" />
                    <stop offset="60%" stopColor={ACCENT_GOLD} stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#0B132B" stopOpacity="0" />
                  </radialGradient>
                  {/* Переливающееся золотое свечение по внешнему кругу */}
                  <linearGradient id="outerSweepGrad" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={ACCENT_GOLD} stopOpacity="0" />
                    <stop offset="35%" stopColor={ACCENT_GOLD} stopOpacity="0.05" />
                    <stop offset="50%" stopColor={ACCENT_GOLD} stopOpacity="0.55" />
                    <stop offset="65%" stopColor={ACCENT_GOLD} stopOpacity="0.05" />
                    <stop offset="100%" stopColor={ACCENT_GOLD} stopOpacity="0" />
                    <animateTransform
                      attributeName="gradientTransform"
                      type="rotate"
                      from="0 50 50"
                      to="360 50 50"
                      dur="9s"
                      repeatCount="indefinite"
                    />
                  </linearGradient>
                  <filter id="centerGlowFilter" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Секторы компаса (9 равных направлений), плавные переходы */}
                {NUMBERS.map((n, i) => (
                  <path
                    key={i}
                    d={segmentPath(i)}
                    fill={`url(#segmentGrad-${i})`}
                    stroke="rgba(201, 169, 110, 0.08)"
                    strokeWidth={0.25}
                  />
                ))}

                {/* Тонкие радиальные линии навигации (только основные) */}
                {NUMBERS.map((_, i) => {
                  const angle = -90 + i * SECTOR_ANGLE;
                  const outer = polar(CX, CY, WHEEL_OUTER_R, angle);
                  return (
                    <line
                      key={`radial-${i}`}
                      x1={CX}
                      y1={CY}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="rgba(201, 169, 110, 0.14)"
                      strokeWidth={0.2}
                    />
                  );
                })}

                {/* Мелкие тики компаса по внешнему кольцу */}
                {NUMBERS.map((_, i) => {
                  const angle = -90 + i * SECTOR_ANGLE;
                  const inner = polar(CX, CY, TICK_INNER_R, angle);
                  const outer = polar(CX, CY, TICK_OUTER_R, angle);
                  return (
                    <line
                      key={`tick-${i}`}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="rgba(201, 169, 110, 0.38)"
                      strokeWidth={0.4}
                    />
                  );
                })}

                {/* Числа: чуть ближе к центру, крупнее (+15–20%), минимальная типографика */}
                {NUMBERS.map((n, i) => {
                  const pos = numberPosition(i, NUMBER_RADIUS);
                  return (
                    <text
                      key={i}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={NUMBER_COLOR}
                      fontSize="7.8"
                      fontWeight="500"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                      style={{ letterSpacing: "0.02em" }}
                    >
                      {n}
                    </text>
                  );
                })}

                {/* Внешнее золотое кольцо */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={OUTER_RING_R}
                  fill="none"
                  stroke={ACCENT_GOLD}
                  strokeWidth={OUTER_RING_STROKE}
                  strokeLinejoin="round"
                  opacity={0.5}
                />
                {/* Переливающееся по кругу золотое свечение */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={OUTER_RING_R + 0.3}
                  fill="none"
                  stroke="url(#outerSweepGrad)"
                  strokeWidth={OUTER_RING_STROKE * 1.15}
                  strokeLinecap="round"
                  opacity={0.9}
                />
                {/* "Молния" по внешнему кругу — короткий яркий сегмент, который бежит по окружности */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={OUTER_RING_R + 1.1}
                  fill="none"
                  stroke={ACCENT_GOLD}
                  strokeWidth={0.65}
                  strokeLinecap="round"
                  strokeDasharray="5 40"
                  strokeOpacity={0.0}
                >
                  <animate
                    attributeName="stroke-opacity"
                    values="0;1;0"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 50 50"
                    to="360 50 50"
                    dur="3.6s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Тонкое кольцо вокруг центра */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={INNER_RING_R}
                  fill="none"
                  stroke="rgba(201, 169, 110, 0.28)"
                  strokeWidth={0.45}
                />

                {/* Компасные направления N / E / S / W по внешнему кругу */}
                {[
                  { label: "N", angle: -90 },
                  { label: "E", angle: 0 },
                  { label: "S", angle: 90 },
                  { label: "W", angle: 180 },
                ].map((dir) => {
                  const pos = polar(CX, CY, OUTER_RING_R + 4, dir.angle);
                  return (
                    <text
                      key={dir.label}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(232, 220, 192, 0.9)"
                      fontSize="4.6"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                      letterSpacing="0.08em"
                    >
                      {dir.label}
                    </text>
                  );
                })}

                {/* Центр: мягкое свечение + тонкое кольцо вокруг ядра + лёгкие радиальные лучи */}
                <g filter="url(#centerGlowFilter)">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const end = polar(CX, CY, 14, deg);
                    return (
                      <line
                        key={deg}
                        x1={CX}
                        y1={CY}
                        x2={end.x}
                        y2={end.y}
                        stroke={ACCENT_GOLD}
                        strokeWidth={0.3}
                        opacity={0.28}
                      />
                    );
                  })}
                  <circle cx={CX} cy={CY} r="13" fill="url(#centerGlow)" />
                  <circle cx={CX} cy={CY} r={CENTER_CORE_RING_R} fill="none" stroke="rgba(232, 220, 192, 0.4)" strokeWidth="0.4" />
                  <circle
                    className="wheel-center-core"
                    cx={CX}
                    cy={CY}
                    r="4.5"
                    fill={ACCENT_GOLD}
                    stroke="rgba(232, 220, 192, 0.85)"
                    strokeWidth="0.45"
                  />
                      </g>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <button className={`spin-button ${isSpinning ? "loading" : ""}`} onClick={handleSpin} disabled={isSpinning}>
                {isSpinning ? "Крутим..." : "Крутить"}
              </button>

              {hasResult && (
                <div className="result-text">
                  <p className="result-title">Ваша цифра дня: {resultNumber}</p>
                  <p className="result-description">
                    {dailyMessage
                      ? dailyMessage
                      : `Описание: сегодня число ${resultNumber} подсказывает держать курс на приоритеты и не распыляться.`}
                  </p>
                  <button type="button" className="secondary-button" onClick={() => setShowBirthSpreadModal(true)}>
                    Сделать расклад по дате рождения
                  </button>
                </div>
              )}
              <button type="button" className="reset-link" onClick={handleResetProfile}>
                /delete — очистить локальные данные
              </button>
            </section>
          )}
        </div>

        <nav className="bottom-nav">
          <button
            type="button"
            className="bottom-nav-button bottom-nav-button--primary"
            onClick={() => setShowCompass(true)}
          >
            Цифра дня
          </button>
          <button
            type="button"
            className="bottom-nav-button bottom-nav-button--menu"
            onClick={() => {
              setShowMainMenuScreen(true);
            }}
            >
            Меню
          </button>
          <button
            type="button"
            className="bottom-nav-button bottom-nav-button--primary"
            onClick={() => {
              setShowMainMenuScreen(false);
              setShowCabinetMenuScreen(true);
            }}
          >
            Личный кабинет
          </button>
        </nav>
      </div>

      {showBirthSpreadModal && (
        <div className="modal-overlay" onClick={() => setShowBirthSpreadModal(false)} aria-hidden="false">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowBirthSpreadModal(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <p className="modal-text">
              Перейдите в личный кабинет бота, чтобы получить свой расклад по дате рождения.
            </p>
            <div className="modal-actions">
              <button type="button" className="modal-close-app-btn" onClick={handleOpenCabinet}>
                Личный кабинет
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
