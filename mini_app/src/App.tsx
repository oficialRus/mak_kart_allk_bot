import { Fragment, useEffect, useRef, useState } from "react";
import { expandViewport, requestFullscreen } from "@telegram-apps/sdk";
import MainMenuScreen from "./screens/MainMenuScreen";
import CabinetMenuScreen from "./screens/CabinetMenuScreen";
import DailyNumberScreen from "./screens/DailyNumberScreen";
import MyReviewsScreen from "./screens/MyReviewsScreen";
import CardStarAtmosphere from "./components/CardStarAtmosphere";

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

type LearningSurvey = {
  level: "novice" | "experienced";
  goal: "self" | "answers" | "practice";
  format: "cards" | "numbers" | "both";
};

type BirthCodeReport = {
  personalityType: string;
  keyEnergy: string;
  decisionPattern: string;
  strengths: string[];
  conflicts: string[];
  focusNow: string;
};

type AppScreen = "daily" | "menu" | "cabinet" | "aiCoach" | "reviews";
type DialogOrigin = "none" | "technique" | "cardDecode" | "cardDay" | "birthCode" | "review";

const STORAGE_KEY_PROFILE = "garmonia_compass_profile_v1";

/** Послание дня: API, описание карты, текст по названию или общий текст — чтобы блок не пропадал при пустых полях в БД или старом API. */
function resolveCardDayMessage(raw: {
  day_message?: string;
  dayMessage?: string;
  description?: string;
  title?: string;
}): string {
  const fromApi = (raw.day_message ?? raw.dayMessage ?? "").trim();
  if (fromApi) return fromApi;
  const desc = (raw.description ?? "").trim();
  if (desc) return desc;
  const t = (raw.title ?? "").trim();
  if (t) {
    return `Сегодняшняя карта — «${t}». Позвольте образу побыть с вами: что он подсвечивает в настроении и в том, что вы откладываете? Выберите один маленький, бережный шаг к себе — без давления, как лёгкий эксперимент на день.`;
  }
  return "Позвольте образу на карте побыть с вами: заметьте детали, дыхание и одну мысль без спешки. Сегодня можно сделать один маленький, бережный шаг — как лёгкий эксперимент, без давления на себя.";
}

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

const TECHNIQUE_DONE_TOKEN = "[[TECHNIQUE_DONE]]";

function hashStringToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  return positive % modulo;
}

/** Ключ «сегодня» по календарю Москвы — как `todayMSK` на бэкенде и текст про 00:00 МСК. */
function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toRootNumber(value: number): number {
  let n = Math.abs(value);
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return n === 0 ? 1 : n;
}

function buildBirthCodeReport(birthDate: string): BirthCodeReport {
  const digits = birthDate.replace(/\D+/g, "");
  const nums = digits.split("").map((d) => Number(d)).filter((n) => Number.isFinite(n));
  const sumAll = nums.reduce((s, n) => s + n, 0);
  const lifeCode = toRootNumber(sumAll);
  const day = Number(digits.slice(0, 2) || "1");
  const month = Number(digits.slice(2, 4) || "1");
  const dayCode = toRootNumber(day);
  const monthCode = toRootNumber(month);

  const personalities = [
    "Исследователь чувств и смыслов",
    "Эмпатичный коммуникатор",
    "Системный стратег",
    "Создатель новых решений",
    "Проводник через перемены",
    "Гармонизатор отношений",
    "Интуитивный аналитик",
    "Практик с внутренней глубиной",
    "Вдохновляющий наставник",
  ];
  const energies = [
    "мягкая внутренняя устойчивость",
    "сила диалога и поддержки",
    "ясность структуры и порядка",
    "творческая смелость",
    "готовность обновляться",
    "баланс и объединение людей",
    "глубокая интуиция",
    "фокус на результате",
    "видение будущего шага",
  ];

  const personalityType = personalities[(lifeCode - 1) % personalities.length];
  const keyEnergy = energies[(dayCode + monthCode - 2 + energies.length) % energies.length];

  const decisionPattern =
    lifeCode % 2 === 0
      ? "Вы чаще принимаете решения через анализ и проверку фактов, но в стрессовых ситуациях можете затягивать выбор."
      : "Вы чаще принимаете решения через внутреннее ощущение правильного шага, но иногда спешите, если эмоции слишком сильные.";

  const strengths = [
    "Умение чувствовать суть ситуации и выделять главное.",
    lifeCode >= 5
      ? "Быстрая адаптация к изменениям и новым условиям."
      : "Способность выстраивать стабильность и опору для себя и близких.",
    dayCode >= 5
      ? "Смелость проявляться и брать инициативу."
      : "Внимательность к деталям и качеству решений.",
  ];

  const conflicts = [
    "Колебания между \"делать правильно\" и \"делать по-настоящему своё\".",
    monthCode % 2 === 0
      ? "Накопление напряжения из-за повышенного контроля."
      : "Эмоциональные перепады и сомнения перед важным шагом.",
    "Склонность обесценивать уже пройденный путь.",
  ];

  const focusNow =
    lifeCode >= 7
      ? "Снизить внутренний шум, вернуться к телесным ощущениям и выбрать один конкретный шаг на ближайшие 48 часов."
      : "Укрепить личные границы, определить 1 приоритет на неделю и действовать без распыления.";

  return {
    personalityType,
    keyEnergy,
    decisionPattern,
    strengths,
    conflicts,
    focusNow,
  };
}

// Внешнее золотое кольцо компаса
const OUTER_RING_R = 47.8;
const OUTER_RING_STROKE = 0.85;

// Палитра секторов: светлые пастельные тона (в т.ч. голубые) под светлую тему
const SEGMENT_GRADIENTS = [
  { from: "#f8fafc", to: "#e2e8f0" },
  { from: "#eff6ff", to: "#dbeafe" },
  { from: "#f0f9ff", to: "#e0f2fe" },
  { from: "#eef2ff", to: "#e0e7ff" },
  { from: "#f1f5f9", to: "#cbd5e1" },
  { from: "#f8fafc", to: "#e2e8f0" },
  { from: "#eff6ff", to: "#bfdbfe" },
  { from: "#f0f9ff", to: "#bae6fd" },
  { from: "#f8fafc", to: "#cbd5e1" },
];

const NUMBER_COLOR = "#0f172a";
const ACCENT_GOLD = "#2563eb";

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
  const [dialogImageDataUrl, setDialogImageDataUrl] = useState<string | null>(null);
  const [dialogAllowImage, setDialogAllowImage] = useState(true);
  const [showDialogScreen, setShowDialogScreen] = useState(false);
  const [showTechniqueDialogMenu, setShowTechniqueDialogMenu] = useState(false);
  const [dialogScenario, setDialogScenario] = useState<"analyze" | "run" | "ask" | null>(null);
  const [showProceedTechniqueNow, setShowProceedTechniqueNow] = useState(false);
  const [isTechniqueRunFinished, setIsTechniqueRunFinished] = useState(false);
  const [showAskNextOptions, setShowAskNextOptions] = useState(false);
  const [learningSurvey, setLearningSurvey] = useState<LearningSurvey | null>(null);
  const [dialogOrigin, setDialogOrigin] = useState<DialogOrigin>("none");
  const [navigationStack, setNavigationStack] = useState<AppScreen[]>(["daily"]);
  const [showCardDecodeScreen, setShowCardDecodeScreen] = useState(false);
  const [showCardDayScreen, setShowCardDayScreen] = useState(false);
  const [cardDay, setCardDay] = useState<{ title: string; description: string; imagePath?: string; dayMessage?: string | null } | null>(null);
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
  const [showBirthCodeIntro, setShowBirthCodeIntro] = useState(false);
  const [showBirthCodeLoading, setShowBirthCodeLoading] = useState(false);
  const [birthCodeReport, setBirthCodeReport] = useState<BirthCodeReport | null>(null);
  const dialogHistoryRef = useRef<HTMLDivElement | null>(null);
  const [isDialogInputFocused, setIsDialogInputFocused] = useState(false);
  const [clearDialogInputOnFocus, setClearDialogInputOnFocus] = useState(false);

  const selectedTechniqueForDialog =
    selectedTechniqueId != null ? TECHNIQUES.find((t) => t.id === selectedTechniqueId) ?? null : null;

  const activateScreen = (screen: AppScreen) => {
    setShowMainMenuScreen(screen === "menu");
    setShowCabinetMenuScreen(screen === "cabinet");
    setShowAiCoachScreen(screen === "aiCoach");
    setShowMyReviewsScreen(screen === "reviews");
    setShowCompass(screen === "daily");
    setActiveTab(
      screen === "menu" || screen === "aiCoach"
        ? "menu"
        : screen === "cabinet" || screen === "reviews"
          ? "cabinet"
          : "daily",
    );
  };

  const pushScreen = (screen: AppScreen) => {
    setNavigationStack((prev) => [...prev, screen]);
    activateScreen(screen);
  };

  const resetToMainMenu = () => {
    setNavigationStack(["menu"]);
    activateScreen("menu");
    setShowDialogScreen(false);
    setShowCardDecodeScreen(false);
    setShowCardDayScreen(false);
    setShowBirthCodeIntro(false);
    setShowBirthCodeLoading(false);
    setBirthCodeReport(null);
    setShowTechniquesList(false);
    setSelectedTechniqueId(null);
    setShowTechniqueDialogMenu(false);
    setDialogFromReview(false);
    setDialogOrigin("none");
  };

  const goBack = () => {
    setNavigationStack((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      activateScreen(next[next.length - 1]);
      return next;
    });
  };

  /** Снова показать блок «Выберите одну из 9 карт…» (сброс локального выбора на сегодня). */
  const resetCardDayToGridSelection = () => {
    setCardDay(null);
    setCardDaySelectedIndex(null);
    setCardDayHint(null);
    setCardDayError(null);
    setCardDayLoading(false);
    setCardDayChosenToday(false);
    try {
      window.localStorage.removeItem("card_day_chosen_date");
    } catch {
      // ignore
    }
  };

  const handleAiCoachBack = () => {
    if (showDialogScreen) {
      if (dialogOrigin === "technique" && !showTechniqueDialogMenu) {
        setShowTechniqueDialogMenu(true);
        setShowAskNextOptions(false);
        setShowProceedTechniqueNow(false);
        setIsTechniqueRunFinished(false);
        setDialogScenario(null);
        setDialogLoading(false);
        setDialogError(null);
        setDialogImageDataUrl(null);
        setDialogAllowImage(false);
        setDialogMessages([]);
        setDialogInput("");
        setClearDialogInputOnFocus(false);
        setIsDialogInputFocused(false);
        return;
      }
      setShowDialogScreen(false);
      setShowTechniqueDialogMenu(false);
      setShowAskNextOptions(false);
      setShowProceedTechniqueNow(false);
      setDialogScenario(null);
      setDialogLoading(false);
      setDialogError(null);
      setDialogImageDataUrl(null);
      if (dialogOrigin === "review" || dialogFromReview) {
        setDialogFromReview(false);
        setDialogOrigin("none");
        goBack();
        return;
      }
      if (dialogOrigin === "cardDay") {
        resetCardDayToGridSelection();
        setShowCardDayScreen(true);
      } else if (dialogOrigin === "cardDecode") {
        setShowCardDecodeScreen(true);
      } else if (dialogOrigin === "birthCode") {
        setShowBirthCodeIntro(false);
        setShowBirthCodeLoading(false);
        setBirthCodeReport(buildBirthCodeReport(profile?.birthDate ?? ""));
      } else if (dialogOrigin === "technique") {
        setShowTechniquesList(true);
        // Оставляем выбранную технику — экран «Разобрать технику с ИИ‑психологом».
      } else {
        resetToMainMenu();
        return;
      }
      setDialogOrigin("none");
      return;
    }
    if (selectedTechniqueId != null) {
      setSelectedTechniqueId(null);
      return;
    }
    if (showTechniquesList) {
      setShowTechniquesList(false);
      return;
    }
    if (showCardDecodeScreen) {
      setShowCardDecodeScreen(false);
      return;
    }
    if (showCardDayScreen) {
      setShowCardDayScreen(false);
      return;
    }
    if (birthCodeReport) {
      setBirthCodeReport(null);
      setShowBirthCodeIntro(true);
      return;
    }
    if (showBirthCodeLoading) {
      setShowBirthCodeLoading(false);
      setShowBirthCodeIntro(true);
      return;
    }
    if (showBirthCodeIntro) {
      setShowBirthCodeIntro(false);
      return;
    }
    goBack();
  };

  const renderDialogText = (text: string) => {
    // Сохраняем переносы строк и визуально выделяем "Шаг N".
    const lines = text.split(/\n/);
    return lines.map((line, idx) => {
      const tokens = line.split(/(Шаг\s*\d+)/g);
      return (
        <Fragment key={`${idx}-${line}`}>
          {tokens.map((t, i) => {
            const isStepToken = /^Шаг\s*\d+$/u.test(t.trim());
            return isStepToken ? (
              <span key={i} className="dialog-technique-step">
                {t}
              </span>
            ) : (
              <Fragment key={i}>{t}</Fragment>
            );
          })}
          {idx < lines.length - 1 ? <br /> : null}
        </Fragment>
      );
    });
  };

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

  // Критично: для Telegram-пользователя ориентируемся на профиль в БД.
  // Если профиля в БД нет (первый запуск), показываем экран регистрации.
  // localStorage используем только как fallback для локальной разработки без initData.
  useEffect(() => {
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

    if (initData) {
      (async () => {
        try {
          const res = await fetch(`${apiBase}/api/profile-get`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });

          if (!res.ok) {
            // 404 => профиль не создан: остаёмся на экране регистрации.
            return;
          }

          const data = (await res.json()) as {
            fullName: string;
            birthDate: string;
            learningLevel?: string;
            learningGoal?: string;
            learningFormat?: string;
          };
          if (!data.fullName || !data.birthDate) return;

          const parsed: Profile = {
            fullName: data.fullName,
            birthDate: data.birthDate,
          };
          setProfile(parsed);
          setProfileForm(parsed);
          if (data.learningLevel && data.learningGoal && data.learningFormat) {
            setLearningSurvey({
              level: data.learningLevel as LearningSurvey["level"],
              goal: data.learningGoal as LearningSurvey["goal"],
              format: data.learningFormat as LearningSurvey["format"],
            });
          }
          setNavigationStack(["menu"]);
          activateScreen("menu");
          try {
            window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        } catch {
          // Если сеть недоступна, ничего не ломаем: пользователь остаётся на регистрации.
        }
      })();
      return;
    }

    // Локальная разработка без Telegram initData.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Profile;
      if (!parsed.fullName || !parsed.birthDate) return;
      setProfile(parsed);
      setProfileForm(parsed);
      setNavigationStack(["menu"]);
      activateScreen("menu");
    } catch {
      // ignore
    }
  }, []);

  // Если профиль уже есть и приложение открыто с параметром ?screen=main_menu,
  // сразу показываем главное меню внутри мини‑приложения.
  useEffect(() => {
    if (profile && initialScreen === "main_menu") {
      setNavigationStack(["menu"]);
      activateScreen("menu");
    }
  }, [profile, initialScreen]);

  // Автопрокрутка чата к последнему сообщению:
  // срабатывает на новые сообщения и во время появления индикатора "печатает...".
  useEffect(() => {
    if (!showDialogScreen) return;
    const el = dialogHistoryRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const lastIdx = dialogMessages.length - 1;
      const last = dialogMessages[lastIdx];
      // Прокручиваем к началу ответа ИИ, чтобы пользователь видел первые строки.
      if (last && last.from === "ai") {
        const lastEl = el.querySelector(`[data-msg-index="${lastIdx}"]`) as HTMLElement | null;
        if (lastEl) {
          el.scrollTo({ top: lastEl.offsetTop, behavior: "smooth" });
        } else {
          el.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
  }, [dialogMessages, showDialogScreen]);

  // В момент ввода текста (появляется клавиатура) фиксированное `bottom-nav` может "вылезать" поверх инпута.
  // Скрываем меню только пока фокус на `textarea.dialog-input`.
  useEffect(() => {
    if (!showDialogScreen) {
      setIsDialogInputFocused(false);
      setShowTechniqueDialogMenu(false);
      setDialogScenario(null);
      setShowProceedTechniqueNow(false);
      setClearDialogInputOnFocus(false);
      setIsTechniqueRunFinished(false);
      setShowAskNextOptions(false);
    }
  }, [showDialogScreen]);

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
    setNavigationStack(["menu"]);
    activateScreen("menu");
    setIsProfileSubmitting(false);
  };

  const handleResetProfile = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY_PROFILE);
    } catch {
      // ignore
    }
    setProfile(null);
    setLearningSurvey(null);
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
      setDialogOrigin("review");
      setShowMyReviewsScreen(false);
      pushScreen("aiCoach");
      setShowDialogScreen(true);
      setShowTechniqueDialogMenu(false);
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

  const handleSaveCabinetProfile = async (data: { fullName: string; birthDate: string }): Promise<{ ok: boolean; error?: string }> => {
    const fullNameCheck = validateFullName(data.fullName);
    if (fullNameCheck.error) {
      return { ok: false, error: fullNameCheck.error };
    }
    const birthDateCheck = validateBirthDate(data.birthDate);
    if (birthDateCheck.error) {
      return { ok: false, error: birthDateCheck.error };
    }

    const fullName = (fullNameCheck.normalized ?? data.fullName.trim()).replace(/\s+/g, " ");
    const birthDate = birthDateCheck.normalized ?? data.birthDate.trim();

    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

    try {
      const res = await fetch(`${apiBase}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          fullName,
          birthDate,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        return { ok: false, error: msg || "Не удалось сохранить данные." };
      }

      setCabinetProfile((prev) => ({
        fullName,
        birthDate,
        phone: prev?.phone,
      }));

      // Обновляем профиль приложения, чтобы остальные расчёты использовали новые данные.
      const updatedProfile: Profile = { fullName, birthDate };
      setProfile(updatedProfile);
      setProfileForm(updatedProfile);
      try {
        window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updatedProfile));
      } catch {
        // ignore
      }

      return { ok: true };
    } catch {
      return { ok: false, error: "Произошла ошибка сети. Попробуйте ещё раз." };
    }
  };

  const handleSaveLearningSurvey = async (payload: LearningSurvey): Promise<boolean> => {
    if (!profile) return false;
    const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
    const initData = w.Telegram?.WebApp?.initData ?? "";
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    try {
      const res = await fetch(`${apiBase}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          fullName: profile.fullName,
          birthDate: profile.birthDate,
          learningLevel: payload.level,
          learningGoal: payload.goal,
          learningFormat: payload.format,
        }),
      });
      if (!res.ok) return false;
      setLearningSurvey(payload);
      return true;
    } catch {
      return false;
    }
  };

  const openCardDayDialogWithAi = async () => {
    if (!cardDay) return;

    const userMessage = [
      "Хочу разобрать мою карту дня с ИИ‑психологом.",
      cardDay.title ? `Название карты: ${cardDay.title}` : "",
      cardDay.description ? `Описание карты: ${cardDay.description}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setShowCardDayScreen(false);
    setShowDialogScreen(true);
    setShowTechniqueDialogMenu(false);
    setShowTechniquesList(false);
    setShowCardDecodeScreen(false);
    setDialogFromReview(false);
    setDialogOrigin("cardDay");
    setDialogAllowImage(false);
    setDialogMessages([{ from: "user", text: userMessage }]);
    setDialogInput("");
    setDialogError(null);
    setDialogLoading(true);

    let imageDataUrl: string | null = null;
    try {
      const rawImagePath = (cardDay.imagePath ?? "").trim();
      if (rawImagePath) {
        if (rawImagePath.startsWith("data:")) {
          imageDataUrl = rawImagePath;
        } else {
          const absoluteImageURL = new URL(rawImagePath, window.location.href).toString();
          const imageResp = await fetch(absoluteImageURL);
          if (imageResp.ok) {
            const blob = await imageResp.blob();
            imageDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  resolve(reader.result);
                } else {
                  reject(new Error("failed to convert image blob to data url"));
                }
              };
              reader.onerror = () => reject(reader.error ?? new Error("file reader error"));
              reader.readAsDataURL(blob);
            });
          }
        }
      }
    } catch {
      // Если изображение не получилось подготовить — продолжаем с текстом.
      imageDataUrl = null;
    }

    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
      const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
      const initData = w.Telegram?.WebApp?.initData ?? "";
      const res = await fetch(`${apiBase}/api/ai-dialog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          message: userMessage,
          history: [],
          imageDataUrl,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        setDialogError(msg || "Не удалось получить ответ. Попробуйте ещё раз позже.");
        return;
      }

      const data = (await res.json()) as { reply: string };
      if (data.reply?.trim()) {
        setDialogMessages((prev) => [...prev, { from: "ai", text: data.reply.trim() }]);
      }
    } catch {
      setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
    } finally {
      setDialogLoading(false);
      setDialogImageDataUrl(null);
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
            <section className="roulette-card onboarding-card roulette-card--stars">
              <CardStarAtmosphere />
              <h1 className="onboarding-title">ИИ‑Психолог Коуч</h1>
              {showTechniquesList ? (
                <>
                  <p className="onboarding-subtitle">Выберите технику, чтобы прочитать подробное описание.</p>
                  {!selectedTechnique && (
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
                  )}
                  {selectedTechnique && (
                    <>
                      <div className="technique-text">
                        <h2 className="technique-title">{selectedTechnique.title}</h2>
                        <p className="technique-body">{selectedTechnique.text}</p>
                      </div>
                      <p className="technique-scroll-hint">Проведите вверх, чтобы прочитать технику полностью</p>
                      <button
                        type="button"
                        className="spin-button"
                        style={{ marginTop: "0.4rem" }}
                        onClick={() => {
                          // Переходим в диалог с ИИ‑психологом и передаём туда выбранную технику.
                          setShowTechniquesList(false);
                          setShowDialogScreen(true);
                          setShowTechniqueDialogMenu(true);
                          setShowCardDecodeScreen(false);
                          setShowCardDayScreen(false);
                          setDialogOrigin("technique");
                          setDialogAllowImage(false);
                          setDialogMessages([]);
                          setDialogError(null);
                          setDialogInput("");
                          setDialogLoading(false);
                        }}
                      >
                        Разобрать технику с ИИ‑психологом
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (selectedTechnique) {
                        // Возвращаемся к списку техник.
                        setSelectedTechniqueId(null);
                      } else {
                        // Возвращаемся к выбору режимов работы.
                        setShowTechniquesList(false);
                        setSelectedTechniqueId(null);
                      }
                    }}
                  >
                    {selectedTechnique ? "Назад" : "Назад"}
                  </button>
                  <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                    Главное меню
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
                      setShowTechniqueDialogMenu(false);
                      setDialogOrigin("cardDecode");
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
                    Назад
                  </button>
                  <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                    Главное меню
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
                                  const data = (await res.json()) as {
                                    title: string;
                                    description: string;
                                    image_path?: string;
                                    day_message?: string;
                                    dayMessage?: string;
                                  };
                                  setCardDay({
                                    title: data.title ?? "",
                                    description: data.description ?? "",
                                    imagePath: data.image_path,
                                    dayMessage: resolveCardDayMessage(data),
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
                        {cardDay.title && <h2 className="technique-title">{cardDay.title}</h2>}
                        {cardDay.imagePath && (
                          <div className="card-day-image-wrapper">
                            <img src={cardDay.imagePath} alt={cardDay.title || "Карта дня"} className="card-day-image" />
                          </div>
                        )}
                        <h3 className="card-day-message-title">Послание на день</h3>
                        <p className="technique-body card-day-daily-message">
                          {(cardDay.dayMessage ?? "").trim()
                            ? (cardDay.dayMessage ?? "").trim()
                            : resolveCardDayMessage({
                                title: cardDay.title,
                                description: cardDay.description,
                              })}
                        </p>
                        <p className="technique-body card-day-reflection-hint">
                          {`Можно отметить для себя:\n• какие детали привлекают внимание;\n• какие чувства и мысли появляются;\n• с какими ситуациями в вашей жизни это перекликается.`}
                        </p>
                        <button
                          type="button"
                          className="spin-button"
                          onClick={() => {
                            void openCardDayDialogWithAi();
                          }}
                        >
                          Разобрать карту с ИИ психологом
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (cardDay) {
                        resetCardDayToGridSelection();
                      } else {
                        setShowCardDayScreen(false);
                      }
                    }}
                  >
                    Назад
                  </button>
                  <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                    Главное меню
                  </button>
                </>
              ) : showBirthCodeIntro ? (
                <>
                  <h2 className="technique-title">Ваш психологический код по дате рождения</h2>
                  <div className="technique-text">
                    <p className="technique-body">
                      {`Это не просто расчёт.\n\nДата рождения — это структура вашей личности:\nваши сильные стороны, внутренние конфликты,\nповеденческие паттерны и точки роста.\n\nЯ разберу её и покажу,\nкак вы мыслите, принимаете решения\nи что сейчас влияет на ваше состояние.\n\nОткройте ниже, чтобы получить свой разбор.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="spin-button"
                    onClick={() => {
                      setShowBirthCodeIntro(false);
                      setShowBirthCodeLoading(true);
                      setBirthCodeReport(null);
                      window.setTimeout(() => {
                        setBirthCodeReport(buildBirthCodeReport(profile?.birthDate ?? ""));
                        setShowBirthCodeLoading(false);
                      }, 2200);
                    }}
                  >
                    👉 Получить разбор
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowBirthCodeIntro(false);
                    }}
                  >
                    Назад
                  </button>
                  <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                    Главное меню
                  </button>
                </>
              ) : showBirthCodeLoading ? (
                <>
                  <h2 className="technique-title">Я анализирую вашу дату…</h2>
                  <div className="technique-text">
                    <p className="technique-body">
                      {`Смотрю на ключевые числа,\nповеденческие паттерны\nи текущие внутренние процессы.\n\nЭто займёт несколько секунд.`}
                    </p>
                  </div>
                </>
              ) : birthCodeReport ? (
                <>
                  <h2 className="technique-title">Ваш психологический код по дате рождения</h2>
                  <div className="technique-text technique-text--birth-code">
                    <h3 className="birth-code-section-title">🔹 Ваш базовый профиль</h3>
                    <p className="technique-body">
                      <strong>Тип личности:</strong> {birthCodeReport.personalityType}
                    </p>
                    <p className="technique-body">
                      <strong>Ключевая энергия:</strong> {birthCodeReport.keyEnergy}
                    </p>

                    <h3 className="birth-code-section-title">🔹 Как вы принимаете решения</h3>
                    <p className="technique-body">{birthCodeReport.decisionPattern}</p>

                    <h3 className="birth-code-section-title">🔹 Ваши сильные стороны</h3>
                    <ul className="birth-code-list">
                      {birthCodeReport.strengths.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h3 className="birth-code-section-title">🔹 Внутренние конфликты / ограничения</h3>
                    <ul className="birth-code-list">
                      {birthCodeReport.conflicts.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h3 className="birth-code-section-title">🔹 На что вам сейчас обратить внимание</h3>
                    <p className="technique-body">{birthCodeReport.focusNow}</p>
                  </div>
                  <button
                    type="button"
                    className="spin-button"
                    onClick={() => {
                      const reportText = `Хочу обсудить мой психологический код по дате рождения.\n\nТип личности: ${birthCodeReport.personalityType}\nКлючевая энергия: ${birthCodeReport.keyEnergy}\n\nКак я принимаю решения: ${birthCodeReport.decisionPattern}\n\nСильные стороны:\n- ${birthCodeReport.strengths.join("\n- ")}\n\nОграничения:\n- ${birthCodeReport.conflicts.join("\n- ")}\n\nФокус сейчас: ${birthCodeReport.focusNow}`;

                      setBirthCodeReport(null);
                      setShowBirthCodeIntro(false);
                      setShowBirthCodeLoading(false);
                      setShowDialogScreen(true);
                      setShowTechniqueDialogMenu(false);
                      setShowTechniquesList(false);
                      setShowCardDecodeScreen(false);
                      setShowCardDayScreen(false);
                      setDialogFromReview(false);
                      setDialogOrigin("birthCode");
                      setDialogAllowImage(false);
                      setDialogImageDataUrl(null);
                      setDialogMessages([
                        {
                          from: "user",
                          text: reportText,
                        },
                      ]);
                      setDialogError(null);
                      setDialogInput("");
                      setDialogLoading(false);
                    }}
                  >
                    🤖 Обсудить результат с ИИ психологом
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setBirthCodeReport(null);
                      setShowBirthCodeIntro(true);
                    }}
                  >
                    Назад
                  </button>
                  <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                    Главное меню
                  </button>
                </>
              ) : showDialogScreen ? (
                <>
                  {showTechniqueDialogMenu ? (
                    <>
                      <p className="onboarding-subtitle">что ты хочешь сделать?</p>
                      <div className="main-menu-list" style={{ marginTop: "0.85rem" }}>
                        <button
                          type="button"
                          className="main-menu-item"
                          onClick={() => {
                            setShowTechniqueDialogMenu(false);
                            setDialogScenario("analyze");
                            setShowProceedTechniqueNow(false);
                            setDialogMessages([]);
                            setDialogError(null);
                            setDialogLoading(false);
                            setDialogImageDataUrl(null);
                            setDialogAllowImage(false);
                            const title = selectedTechniqueForDialog?.title ?? "выбранную технику";
                            setDialogInput(
                              "Давайте разберём эту технику под вашу ситуацию. Что сейчас у вас откликается или вызывает напряжение?"
                            );
                            setClearDialogInputOnFocus(true);
                            setShowAskNextOptions(false);
                          }}
                        >
                          разобрать технику
                        </button>
                        <button
                          type="button"
                          className="main-menu-item"
                          onClick={() => {
                            setShowTechniqueDialogMenu(false);
                            setDialogScenario("run");
                            setShowProceedTechniqueNow(false);
                            setIsTechniqueRunFinished(false);
                            setDialogMessages([]);
                            setDialogError(null);
                            setDialogLoading(false);
                            setDialogImageDataUrl(null);
                            setDialogAllowImage(false);
                            setDialogInput("");
                            setIsDialogInputFocused(false);
                            const title = selectedTechniqueForDialog?.title ?? "выбранную технику";
                            setShowAskNextOptions(false);
                            // Стартуем технику сразу, чтобы экран не был пустым.
                            void (async () => {
                              setDialogLoading(true);
                              setDialogError(null);
                              try {
                                const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                                const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                                const initData = w.Telegram?.WebApp?.initData ?? "";
                                const techniqueText = selectedTechniqueForDialog?.text ?? "";
                                const requestMessage = `Ты — ИИ‑психолог‑коуч. Твоя задача — провести пользователя через психологическую технику пошагово (шаг → вопрос → ответ → следующий шаг).

Техника: ${title}
Текст техники: ${techniqueText}

Правила:
1) НЕ выдавай всю технику сразу.
2) В каждом сообщении давай только ОДИН следующий шаг + один конкретный вопрос.
3) Адаптируй формулировку шага под то, что пользователь ответит (используй историю).
4) Говори мягко и поддерживающе, помогай осознавать чувства/мысли.
5) НЕ делай огромных текстов.
6) В конце, когда техника будет полностью завершена, добавь маркер в последней строке: ${TECHNIQUE_DONE_TOKEN}

Начни сейчас:
Короткое введение (1–2 предложения).
Потом: "Начнём." + (переформулированный) Шаг 1.
Затем один вопрос пользователю:
Что вы сейчас видите/чувствуете/выбираете?`;
                                const res = await fetch(`${apiBase}/api/ai-dialog`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    initData,
                                    message: requestMessage,
                                    history: [],
                                    imageDataUrl: null,
                                  }),
                                });
                                if (!res.ok) {
                                  const msg = await res.text();
                                  setDialogError(msg || "Не удалось запустить технику.");
                                } else {
                                  const data = (await res.json()) as { reply: string };
                                  const rawReply = data.reply ?? "";
                                  const cleanedReply = rawReply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
                                  setDialogMessages([{ from: "ai", text: cleanedReply }]);
                                  setDialogError(null);
                                  if (rawReply.includes(TECHNIQUE_DONE_TOKEN)) {
                                    setIsTechniqueRunFinished(true);
                                  }
                                }
                              } catch {
                                setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
                              } finally {
                                setDialogLoading(false);
                              }
                            })();
                          }}
                        >
                          пройти технику
                        </button>
                        <button
                          type="button"
                          className="main-menu-item"
                          onClick={() => {
                            setShowTechniqueDialogMenu(false);
                            setDialogScenario("ask");
                            setShowProceedTechniqueNow(false);
                            setDialogMessages([]);
                            setDialogError(null);
                            setDialogLoading(false);
                            setDialogImageDataUrl(null);
                            setDialogAllowImage(true);
                            const title = selectedTechniqueForDialog?.title ?? "выбранную технику";
                            setDialogInput("Задайте любой вопрос по этой технике или вашему состоянию — я помогу разобраться.");
                            setClearDialogInputOnFocus(true);
                            setShowAskNextOptions(false);
                          }}
                        >
                          задать вопрос
                        </button>
                      </div>
                      <button type="button" className="secondary-button" onClick={handleAiCoachBack}>
                        Назад
                      </button>
                      <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                        Главное меню
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="onboarding-subtitle">
                        {dialogScenario === "analyze"
                          ? "Давайте разберём эту технику под вашу ситуацию — что сейчас у вас откликается или вызывает напряжение?"
                          : dialogScenario === "run"
                            ? "Сейчас проведём технику. Напишите результат выполнения Шага 1 или ваш ответ."
                            : dialogScenario === "ask"
                              ? "Сформулируйте ваш вопрос по выбранной технике — и мы разберём его."
                              : "Напишите, о чём хотите поговорить, и ИИ‑Психолог ответит вам в этом окне."}
                      </p>
                      {dialogAllowImage && (
                        <p className="onboarding-subtitle">Можно прикрепить фото для разбора.</p>
                      )}
                      {(dialogMessages.length > 0 || dialogLoading) && (
                        <div className="dialog-history" ref={dialogHistoryRef}>
                          {dialogMessages.map((m, idx) => (
                            <div
                              key={idx}
                              className={m.from === "user" ? "dialog-bubble dialog-bubble-user" : "dialog-bubble dialog-bubble-ai"}
                              data-msg-index={idx}
                              data-msg-from={m.from}
                            >
                              {renderDialogText(m.text)}
                            </div>
                          ))}
                          {dialogLoading && <div className="dialog-bubble dialog-bubble-ai">Психолог набирает ответ…</div>}
                        </div>
                      )}
                      {dialogError && <p className="dialog-error">{dialogError}</p>}
                        {showProceedTechniqueNow && dialogScenario === "analyze" && (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={dialogLoading}
                          onClick={() => {
                            // Запускаем технику после разбора.
                            const uiUserText = "Пройти технику сейчас";
                            setShowProceedTechniqueNow(false);
                            setDialogScenario("run");
                            setDialogAllowImage(false);
                            setDialogInput("");
                            setDialogError(null);
                            setDialogLoading(true);
                              setIsTechniqueRunFinished(false);

                            void (async () => {
                              try {
                                const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                                const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                                const initData = w.Telegram?.WebApp?.initData ?? "";
                                const techniqueText = selectedTechniqueForDialog?.text ?? "";
                                const techniqueTitle = selectedTechniqueForDialog?.title ?? "";

                                const historyForRequest = [...dialogMessages, { from: "user" as const, text: uiUserText }];
                                setDialogMessages((prev) => [...prev, { from: "user", text: uiUserText }]);

                                const requestMessage = `Ты — ИИ‑психолог‑коуч. Веди пользователя через технику пошагово.\n\nТехника (контекст): ${techniqueTitle}\n${techniqueText}\n\nИстория пользователя и твои предыдущие ответы уже есть.\n\nВ ответе сейчас дай первый следующий шаг (ОДИН шаг) и конкретный вопрос, на который пользователь должен ответить.\n\nПравила:\n1) НЕ выдавай всю технику.\n2) Шаг -> вопрос -> жди ответ.\n3) Адаптируй под ответ пользователя.\n\nЕсли техника подошла к завершению — добавь в конец маркер: ${TECHNIQUE_DONE_TOKEN}\n\nВеди мягко и поддерживающе.`;
                                const res = await fetch(`${apiBase}/api/ai-dialog`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    initData,
                                    message: requestMessage,
                                    history: historyForRequest.map((m) => ({
                                      role: m.from === "user" ? "user" : "assistant",
                                      content: m.text,
                                    })),
                                    imageDataUrl: null,
                                  }),
                                });
                                if (!res.ok) {
                                  const msg = await res.text();
                                  setDialogError(msg || "Не удалось запустить технику.");
                                } else {
                                  const data = (await res.json()) as { reply: string };
                                const rawReply = data.reply ?? "";
                                const cleanedReply = rawReply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
                                setDialogMessages((prev) => [...prev, { from: "ai", text: cleanedReply }]);
                                  setDialogError(null);
                                if (rawReply.includes(TECHNIQUE_DONE_TOKEN)) {
                                  setIsTechniqueRunFinished(true);
                                }
                                }
                              } catch {
                                setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
                              } finally {
                                setDialogLoading(false);
                              }
                            })();
                          }}
                        >
                          👉 Пройти технику сейчас
                        </button>
                      )}
                      <form
                        className="dialog-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const text = dialogInput.trim();
                          if (!text || dialogLoading) return;
                          setDialogError(null);
                          setDialogLoading(true);
                          const techniqueTitle = selectedTechniqueForDialog?.title ?? "";
                          const techniqueText = selectedTechniqueForDialog?.text ?? "";
                          let requestMessage = text;
                          if (dialogScenario && selectedTechniqueForDialog) {
                            if (dialogScenario === "analyze") {
                              requestMessage = `Ты ИИ‑Психолог.\nСценарий: "Разобрать технику под вашу ситуацию" (помочь понять, как техника работает именно для пользователя, ПРЕЖДЕ чем проходить её).
\nТехника: ${techniqueTitle}
Текст техники (используй как справку, не цитируй полностью):\n${techniqueText}
\nСитуация пользователя:\n${text}

Ответь структурно (коротко и по делу):
1) Объясни смысл техники простым языком: что она делает и зачем.
2) Покажи связь с состоянием пользователя: что именно в ситуации откликается/вызывает напряжение и как техника это адресует.
3) Расшифруй каждый шаг: ЗАЧЕМ он, что даёт пользователю именно в этой ситуации.
4) Задай 1–2 уточняющих вопроса (выбери подходящие):
   - "В какой момент вы чаще всего сталкиваетесь с этим состоянием?"
   - "Что именно внутри вас откликается на эту технику?"
5) Подведи итог: "В вашем случае эта техника поможет…" (2–3 предложения).
В конце просто одной строкой: "👉 Пройти технику сейчас" (без больших списков).`;
                            } else if (dialogScenario === "run") {
                              requestMessage = `Ты — ИИ‑психолог‑коуч. Твоя задача — вести пользователя через технику.\n\nТехника (контекст):\n${techniqueTitle}\n${techniqueText}\n\nСейчас пользователь ответил:\n${text}\n\nПравила:\n1) НЕ выдавай всю технику сразу.\n2) Выдавай только ОДИН следующий шаг + один конкретный вопрос.\n3) Шаг адаптируй под то, что пользователь написал, используя историю.\n4) После выполнения шага пользователь должен ответить.\n5) Говори мягко и поддерживающе.\n\nЕсли техника подошла к завершению, то в твоём ответе должна быть финальная поддержка + итог (коротко) + последний вопрос: "Что вы сейчас чувствуете? Что изменилось внутри?". В таком случае ДОПОЛНИТЕЛЬНО добавь в конец точный маркер: ${TECHNIQUE_DONE_TOKEN}`;
                            } else if (dialogScenario === "ask") {
                              requestMessage = `Ты — ИИ‑психолог‑коуч.\n\nСценарий: ответить на вопрос пользователя про эту технику или его состояние.\n\nТехника (контекст):\n${techniqueTitle}\n${techniqueText}\n\nВопрос/сообщение пользователя:\n${text}\n\nТвоя задача:\n1) Отвечай мягко и поддерживающе.\n2) Объясни просто и по-человечески: что это значит и как техника работает именно в такой ситуации.\n3) Упростить: убери лишнее, оставь суть.\n4) Направь: дай 1–3 практичных опоры/действия или мини-шаг.\n5) Если в вопросе есть неопределённость — задай ОДИН уточняющий вопрос.\n\nВ конце (очень коротко, без простыней) предложи следующий шаг из вариантов:\n- "Разобрать технику глубже"\n- "Пройти технику"\n- "В главное меню" (если уместно).`;
                            }
                          }
                          // Формируем историю для отправки на бэкенд:
                          // предыдущие сообщения + текущее пользовательское.
                          const historyForRequest = [...dialogMessages, { from: "user" as const, text }];
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
                                message: requestMessage,
                                history: historyForRequest.map((m) => ({
                                  role: m.from === "user" ? "user" : "assistant",
                                  content: m.text,
                                })),
                                imageDataUrl: dialogImageDataUrl,
                              }),
                            });
                            if (!res.ok) {
                              const msg = await res.text();
                              setDialogError(msg || "Не удалось получить ответ. Попробуйте ещё раз позже.");
                            } else {
                              const data = (await res.json()) as { reply: string };
                              const rawReply = data.reply ?? "";
                              const cleanedReply = rawReply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
                              setDialogMessages((prev) => [...prev, { from: "ai", text: cleanedReply }]);
                            if (dialogScenario === "analyze") setShowProceedTechniqueNow(true);
                            if (dialogScenario === "ask") setShowAskNextOptions(true);
                              if (dialogScenario === "run" && rawReply.includes(TECHNIQUE_DONE_TOKEN)) {
                                setIsTechniqueRunFinished(true);
                              }
                            }
                          } catch {
                            setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
                          } finally {
                            setDialogLoading(false);
                            setDialogImageDataUrl(null);
                          }
                        }}
                      >
                        {dialogAllowImage && (
                          <div className="dialog-attachments">
                            <label className="dialog-attach-button">
                              📷 Прикрепить фото
                              <input
                                type="file"
                                accept="image/*"
                                className="dialog-attach-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) {
                                    setDialogImageDataUrl(null);
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const result = reader.result;
                                    if (typeof result === "string") {
                                      setDialogImageDataUrl(result);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                            {dialogImageDataUrl && <span className="dialog-attach-hint">Фото прикреплено</span>}
                          </div>
                        )}
                        {!((isTechniqueRunFinished && dialogScenario === "run") || (showAskNextOptions && dialogScenario === "ask")) && (
                          <>
                            <textarea
                              className="dialog-input"
                              placeholder={
                                dialogScenario === "analyze"
                                  ? "Что сейчас у вас откликается или вызывает напряжение?"
                                  : dialogScenario === "run"
                                    ? "Что получилось после выполнения Шага 1?"
                                    : dialogScenario === "ask"
                                      ? "Ваш вопрос (что именно хотите понять/прояснить)?"
                                      : "Напишите свой вопрос или опишите ситуацию…"
                              }
                              rows={3}
                              value={dialogInput}
                              onChange={(e) => setDialogInput(e.target.value)}
                              onFocus={() => {
                                setIsDialogInputFocused(true);
                                if (clearDialogInputOnFocus) {
                                  setDialogInput("");
                                  setClearDialogInputOnFocus(false);
                                }
                              }}
                              onBlur={() => {
                                setIsDialogInputFocused(false);
                              }}
                            />
                            <button type="submit" className="spin-button" disabled={dialogLoading || !dialogInput.trim()}>
                              {dialogLoading ? "Отправляем..." : "Отправить"}
                            </button>
                          </>
                        )}
                      </form>
                      {showAskNextOptions && dialogScenario === "ask" ? (
                        <div className="main-menu-list" style={{ marginTop: "1rem" }}>
                          <button
                            type="button"
                            className="main-menu-item"
                            onClick={() => {
                              setShowAskNextOptions(false);
                              setIsTechniqueRunFinished(false);
                              setShowTechniqueDialogMenu(false);
                              setDialogScenario("analyze");
                              setShowProceedTechniqueNow(false);
                              setDialogMessages([]);
                              setDialogError(null);
                              setDialogLoading(false);
                              setDialogImageDataUrl(null);
                              setDialogAllowImage(false);
                              setDialogInput(
                                "Давайте разберём эту технику под вашу ситуацию. Что сейчас у вас откликается или вызывает напряжение?"
                              );
                              setClearDialogInputOnFocus(true);
                            }}
                          >
                            Разобрать технику глубже
                          </button>
                          <button
                            type="button"
                            className="main-menu-item"
                            onClick={() => {
                              setShowAskNextOptions(false);
                              setIsTechniqueRunFinished(false);
                              setShowTechniqueDialogMenu(false);
                              setDialogScenario("run");
                              setShowProceedTechniqueNow(false);
                              setDialogMessages([]);
                              setDialogError(null);
                              setDialogLoading(false);
                              setDialogImageDataUrl(null);
                              setDialogAllowImage(false);
                              setDialogInput("");

                              void (async () => {
                                try {
                                  setDialogLoading(true);
                                  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
                                  const w = window as unknown as { Telegram?: { WebApp?: { initData?: string } } };
                                  const initData = w.Telegram?.WebApp?.initData ?? "";
                                  const title = selectedTechniqueForDialog?.title ?? "выбранная техника";
                                  const techniqueText = selectedTechniqueForDialog?.text ?? "";
                                  const requestMessage = `Ты — ИИ‑психолог‑коуч. Твоя задача — провести пользователя через психологическую технику пошагово.

Техника: ${title}
Текст техники (контекст): ${techniqueText}

Правила:
1) НЕ выдавай всю технику сразу.
2) В каждом сообщении: ОДИН следующий шаг + один конкретный вопрос пользователю.
3) Мягко поддерживай и веди к ответу.
4) В конце завершения добавь маркер в последней строке: ${TECHNIQUE_DONE_TOKEN}

Начни: короткое введение + "Начнём." + Шаг 1 (переформулированный) + вопрос: что вы сейчас видите/чувствуете/выбираете?`;

                                  const res = await fetch(`${apiBase}/api/ai-dialog`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      initData,
                                      message: requestMessage,
                                      history: [],
                                      imageDataUrl: null,
                                    }),
                                  });

                                  if (!res.ok) {
                                    const msg = await res.text();
                                    setDialogError(msg || "Не удалось запустить технику.");
                                    return;
                                  }

                                  const data = (await res.json()) as { reply: string };
                                  const rawReply = data.reply ?? "";
                                  const cleanedReply = rawReply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
                                  setDialogMessages([{ from: "ai", text: cleanedReply }]);
                                  if (rawReply.includes(TECHNIQUE_DONE_TOKEN)) setIsTechniqueRunFinished(true);
                                } catch {
                                  setDialogError("Произошла ошибка сети. Попробуйте ещё раз.");
                                } finally {
                                  setDialogLoading(false);
                                }
                              })();
                            }}
                          >
                            Пройти технику
                          </button>
                        </div>
                      ) : isTechniqueRunFinished && dialogScenario === "run" ? (
                        <div className="main-menu-list" style={{ marginTop: "1rem" }}>
                          <button
                            type="button"
                            className="main-menu-item"
                            onClick={() => {
                              setIsTechniqueRunFinished(false);
                              setShowTechniqueDialogMenu(false);
                              setDialogScenario("analyze");
                              setShowProceedTechniqueNow(false);
                              setDialogMessages([]);
                              setDialogError(null);
                              setDialogLoading(false);
                              setDialogImageDataUrl(null);
                              setDialogAllowImage(false);
                              setDialogInput("Давайте разберём эту технику под вашу ситуацию — что сейчас у вас откликается или вызывает напряжение?");
                              setClearDialogInputOnFocus(true);
                            }}
                          >
                            Разобрать технику глубже
                          </button>
                          <button
                            type="button"
                            className="main-menu-item"
                            onClick={() => {
                              setIsTechniqueRunFinished(false);
                              setShowTechniqueDialogMenu(false);
                              setShowDialogScreen(false);
                              setShowTechniquesList(true);
                              setSelectedTechniqueId(null);
                              setDialogScenario(null);
                              setDialogFromReview(false);
                            }}
                          >
                            Выбрать другую технику
                          </button>
                          <button
                            type="button"
                            className="main-menu-item"
                            onClick={() => {
                              setIsTechniqueRunFinished(false);
                              setShowTechniqueDialogMenu(false);
                              resetToMainMenu();
                            }}
                          >
                            В главное меню
                          </button>
                        </div>
                      ) : (
                        <>
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
                              setDialogOrigin("none");
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
                                setDialogOrigin("none");
                                goBack();
                              }}
                            >
                              ⬅️ Назад к списку разборов
                            </button>
                          )}
                        </>
                      )}
                    </>
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
                                const data = (await res.json()) as {
                                  title: string;
                                  description: string;
                                  image_path?: string;
                                  day_message?: string;
                                  dayMessage?: string;
                                };
                                setCardDay({
                                  title: data.title ?? "",
                                  description: data.description ?? "",
                                  imagePath: data.image_path,
                                  dayMessage: resolveCardDayMessage(data),
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
                        setShowBirthCodeIntro(true);
                        setShowBirthCodeLoading(false);
                        setBirthCodeReport(null);
                        setShowDialogScreen(false);
                        setShowCardDecodeScreen(false);
                        setShowCardDayScreen(false);
                        setShowTechniquesList(false);
                      }}
                    >
                      Ваш психологический код по дате рождения
                    </button>
                  </div>
                  <button type="button" className="secondary-button" onClick={handleAiCoachBack}>
                    Назад
                  </button>
                </>
              )}
              {showDialogScreen && !showTechniqueDialogMenu && (
                <>
                  <button type="button" className="secondary-button" onClick={handleAiCoachBack}>
                    Назад
                  </button>
                  {(dialogOrigin === "cardDecode" || dialogOrigin === "birthCode") && (
                    <button type="button" className="secondary-button" onClick={resetToMainMenu}>
                      Главное меню
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
          <nav className={`bottom-nav ${isDialogInputFocused ? "bottom-nav--hidden" : ""}`}>
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "daily" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                pushScreen("daily");
                setShowBirthCodeIntro(false);
                setShowBirthCodeLoading(false);
                setBirthCodeReport(null);
              }}
            >
              Цифра дня
            </button>
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--menu ${activeTab === "menu" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                pushScreen("menu");
                setShowBirthCodeIntro(false);
                setShowBirthCodeLoading(false);
                setBirthCodeReport(null);
              }}
            >
              Меню
            </button>
            <button
              type="button"
              className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "cabinet" ? "bottom-nav-button--active" : ""}`}
              onClick={() => {
                pushScreen("cabinet");
                setShowBirthCodeIntro(false);
                setShowBirthCodeLoading(false);
                setBirthCodeReport(null);
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
        onOpenReview={handleOpenReview}
        onBack={goBack}
        onMainMenu={resetToMainMenu}
      />
    );
  }

  if (showMainMenuScreen) {
    return (
      <MainMenuScreen
        onOpenDaily={() => {
          pushScreen("daily");
        }}
        onOpenAiCoach={() => {
          pushScreen("aiCoach");
        }}
        onOpenCabinet={() => {
          pushScreen("cabinet");
        }}
        onOpenDigitalPsychologist={() => {
          pushScreen("aiCoach");
          setShowTechniquesList(false);
          setSelectedTechniqueId(null);
          setShowDialogScreen(true);
          setShowTechniqueDialogMenu(false);
          setDialogMessages([]);
          setDialogError(null);
          setDialogInput("");
          setDialogLoading(false);
          setDialogAllowImage(true);
          setDialogOrigin("none");
        }}
        learningSurvey={learningSurvey}
        onSaveLearningSurvey={handleSaveLearningSurvey}
      />
    );
  }

  if (showCabinetMenuScreen) {
    return (
      <CabinetMenuScreen
        onOpenDaily={() => {
          pushScreen("daily");
        }}
        onOpenMenu={() => {
          pushScreen("menu");
        }}
        onShowMyData={handleLoadCabinetProfile}
        myData={cabinetProfile}
        myDataLoading={cabinetProfileLoading}
        myDataError={cabinetProfileError}
        onSaveMyData={handleSaveCabinetProfile}
        onOpenMyReviews={() => {
          pushScreen("reviews");
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
        pushScreen("menu");
      }}
      onOpenCabinet={() => {
        pushScreen("cabinet");
      }}
      onOpenBirthSpreadModal={() => setShowBirthSpreadModal(true)}
      onCloseBirthSpreadModal={() => setShowBirthSpreadModal(false)}
      onOpenCabinetFromModal={handleOpenCabinet}
      activeTab={activeTab}
    />
  );
}
