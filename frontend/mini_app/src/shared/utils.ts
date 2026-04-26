import type { BirthCodeReport } from "./types";
import { DAILY_AFFIRMATIONS } from "./constants";

export function sanitizeFullNameInput(value: string): string {
  return value.replace(/[^A-Za-zА-Яа-яЁё\s-]+/g, "");
}

export function sanitizeBirthDateInput(value: string): string {
  return value.replace(/\D+/g, "");
}

export function formatBirthDateInput(raw: string): string {
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

export function validateFullName(raw: string): { normalized?: string; error?: string } {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { error: "Введите имя" };
  }

  const parts = trimmed.split(" ").filter(Boolean);

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

export function validateBirthDate(raw: string): { normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Введите дату рождения" };
  }

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

/** Послание дня: API, описание карты, текст по названию или общий текст. */
export function resolveCardDayMessage(raw: {
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

export function hashStringToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  return positive % modulo;
}

/** Ключ «сегодня» по календарю Москвы. */
export function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getTodayMoscowRuDate() {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function buildDailyAffirmationMessage() {
  const todayKey = getTodayKey();
  const idx = hashStringToIndex(`${todayKey}|garmonia_affirmation_v1`, DAILY_AFFIRMATIONS.length);
  const text = DAILY_AFFIRMATIONS[idx];
  const dateLabel = getTodayMoscowRuDate();
  return `✨Аффирмация дня - ${dateLabel}✨\n\n«${text}»`;
}

export function getDailyAffirmationText() {
  const todayKey = getTodayKey();
  const idx = hashStringToIndex(`${todayKey}|garmonia_affirmation_v1`, DAILY_AFFIRMATIONS.length);
  return DAILY_AFFIRMATIONS[idx];
}

export function splitDailyAffirmationMessage(raw: string): { title: string; body: string } {
  const parts = raw.split(/\n+/).map((v) => v.trim()).filter(Boolean);
  if (parts.length === 0) return { title: "", body: "" };
  return {
    title: parts[0],
    body: parts.slice(1).join("\n"),
  };
}

export function toRootNumber(value: number): number {
  let n = Math.abs(value);
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return n === 0 ? 1 : n;
}

export function buildBirthCodeReport(birthDate: string): BirthCodeReport {
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

export function buildDailyNumberDescription(num: number): string {
  const byNumber: Record<number, string> = {
    1: "Описание: сегодня число 1 подсказывает смелее начинать новое и делать первый шаг без откладываний.",
    2: "Описание: сегодня число 2 подсказывает сохранять баланс в общении и действовать через сотрудничество.",
    3: "Описание: сегодня число 3 подсказывает держать курс на приоритеты и не распыляться.",
    4: "Описание: сегодня число 4 подсказывает укреплять порядок, завершать начатое и опираться на дисциплину.",
    5: "Описание: сегодня число 5 подсказывает быть гибче к изменениям и использовать новые возможности дня.",
    6: "Описание: сегодня число 6 подсказывает уделить внимание близким, заботе о себе и внутренней гармонии.",
    7: "Описание: сегодня число 7 подсказывает замедлиться, прислушаться к себе и углубиться в важные смыслы.",
    8: "Описание: сегодня число 8 подсказывает действовать решительно в целях и бережно управлять ресурсами.",
    9: "Описание: сегодня число 9 подсказывает завершать лишнее, отпускать старое и освобождать место новому.",
  };
  return byNumber[num] ?? `Описание: сегодня число ${num} подсказывает сохранять фокус и действовать в своём темпе.`;
}
