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

// Внешнее тонкое золотое кольцо
const OUTER_RING_R = 47.8;
const OUTER_RING_STROKE = 0.55;

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

  const resultNumber = winningIndex === null ? "-" : NUMBERS[winningIndex];
  const handleSpin = () => {
    if (isSpinning) {
      return;
    }

    setIsSpinning(true);
    setWinningIndex(null);

    // Какой сектор (0..8) и его цифра (1..9) должны оказаться под указателем (верх)
    const nextWinningIndex = Math.floor(Math.random() * SECTOR_COUNT);
    // В polar верх = 90°. Центр сектора k: -70 + k*40.
    // Для CSS-вращения (по часовой стрелке) хотим, чтобы
    //   segmentCenterDeg - finalRotation ≡ pointerAngle (mod 360)
    // У нас finalRotation = rotation + extraSpins*360 + targetOffset,
    // поэтому учитываем текущий угол rotation по модулю 360:
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
    }, SPIN_DURATION_MS);
  };

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
            <div
              className={`wheel ${isSpinning ? "is-spinning" : ""}`}
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

                {/* Внешнее тонкое золотое кольцо */}
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

                {/* Тонкое кольцо вокруг центра */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={INNER_RING_R}
                  fill="none"
                  stroke="rgba(201, 169, 110, 0.28)"
                  strokeWidth={0.45}
                />

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
                  <circle cx={CX} cy={CY} r="4.5" fill={ACCENT_GOLD} stroke="rgba(232, 220, 192, 0.85)" strokeWidth="0.45" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <button className={`spin-button ${isSpinning ? "loading" : ""}`} onClick={handleSpin} disabled={isSpinning}>
          {isSpinning ? "Крутим..." : "Крутить"}
        </button>

        <div className="result-text">
          <p className="result-title">Ваша цифра дня: {resultNumber}</p>
          <p className="result-description">
            Описание: сегодня число {resultNumber} подсказывает держать курс на приоритеты и не распыляться.
          </p>
        </div>
      </section>
    </main>
  );
}
