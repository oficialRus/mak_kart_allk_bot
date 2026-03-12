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
  // Разрешаем только цифры и точки.
  return value.replace(/[^\d.]+/g, "");
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
    } catch {
      // ignore
    }
  }, []);

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
      nextValue = sanitizeBirthDateInput(value);
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

  if (!profile) {
    return (
      <main className="page">
        <header className="app-header">
          <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>
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
      </main>
    );
  }

  return (
    <main className="page">
      <header className="app-header">
        <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
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
                <svg className="wheel-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="Компас цифровой психологии — девять направлений">
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
              <button
                type="button"
                className="modal-close-app-btn"
                onClick={() => {
                  const w = window as unknown as {
                    Telegram?: {
                      WebApp?: {
                        close?: () => void;
                      };
                    };
                  };
                  try {
                    w.Telegram?.WebApp?.close?.();
                  } catch {
                    // ignore
                  }
                }}
              >
                Закрыть приложение
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
