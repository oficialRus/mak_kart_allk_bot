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

const RIM_MID_R = (RIM_INNER_R + RIM_OUTER_R) / 2;
const RIM_STROKE_WIDTH = RIM_OUTER_R - RIM_INNER_R;

// Палитра: тёмно-синие градиенты, низкий контраст (компас, не рулетка)
const SEGMENT_GRADIENTS = [
  { from: "#0f1629", to: "#151f35" },
  { from: "#0d1526", to: "#131c32" },
  { from: "#111a2e", to: "#172138" },
  { from: "#0b132b", to: "#121b30" },
  { from: "#0e1728", to: "#141d33" },
  { from: "#0c1427", to: "#131b31" },
  { from: "#0b132b", to: "#111a2e" },
  { from: "#0f1629", to: "#151f35" },
  { from: "#10182c", to: "#161e36" },
];

const NUMBER_COLOR = "#E8DCC0"; // тёплый беж
const ACCENT_GOLD = "#C9A96E";

// Тики компаса: основные на границах секторов, второстепенные — посередине
const TICK_MAIN_INNER_R = 44;
const TICK_MAIN_OUTER_R = 48;
const TICK_SECOND_INNER_R = 45;
const TICK_SECOND_OUTER_R = 47;

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
    // Обратная формула: R = pointerAngle - segmentCenter (колесо крутится против часовой)
    const segmentCenterDeg = -90 + (nextWinningIndex + 0.5) * SECTOR_ANGLE;
    const pointerAngle = 90;
    const targetOffset = ((pointerAngle - segmentCenterDeg) % 360 + 360) % 360;
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
      <section className="roulette-card">
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
                  {/* Свечение центра — точка интуиции */}
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E8DCC0" stopOpacity="0.95" />
                    <stop offset="30%" stopColor={ACCENT_GOLD} stopOpacity="0.5" />
                    <stop offset="70%" stopColor={ACCENT_GOLD} stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0B132B" stopOpacity="0" />
                  </radialGradient>
                  <filter id="centerGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Секторы компаса (направления 1–9) */}
                {NUMBERS.map((n, i) => (
                  <path
                    key={i}
                    d={segmentPath(i)}
                    fill={`url(#segmentGrad-${i})`}
                    stroke="rgba(201, 169, 110, 0.12)"
                    strokeWidth={SEGMENT_BORDER_STROKE}
                  />
                ))}

                {/* Радиальные линии навигации от центра */}
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
                      stroke="rgba(201, 169, 110, 0.18)"
                      strokeWidth={0.25}
                    />
                  );
                })}

                {/* Основные тики компаса на границах секторов */}
                {NUMBERS.map((_, i) => {
                  const angle = -90 + i * SECTOR_ANGLE;
                  const inner = polar(CX, CY, TICK_MAIN_INNER_R, angle);
                  const outer = polar(CX, CY, TICK_MAIN_OUTER_R, angle);
                  return (
                    <line
                      key={`tick-${i}`}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="rgba(201, 169, 110, 0.35)"
                      strokeWidth={0.5}
                    />
                  );
                })}
                {/* Второстепенные тонкие разделители (между секторами) */}
                {NUMBERS.map((_, i) => {
                  const angle = -90 + (i + 0.5) * SECTOR_ANGLE;
                  const inner = polar(CX, CY, TICK_SECOND_INNER_R, angle);
                  const outer = polar(CX, CY, TICK_SECOND_OUTER_R, angle);
                  return (
                    <line
                      key={`tick-sec-${i}`}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="rgba(201, 169, 110, 0.15)"
                      strokeWidth={0.3}
                    />
                  );
                })}

                {/* Числа — тёплый беж */}
                {NUMBERS.map((n, i) => {
                  const pos = numberPosition(i, 33);
                  return (
                    <text
                      key={i}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={NUMBER_COLOR}
                      fontSize="7"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                    >
                      {n}
                    </text>
                  );
                })}

                {/* Внешнее тонкое кольцо */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={RIM_MID_R}
                  fill="none"
                  stroke={ACCENT_GOLD}
                  strokeWidth={RIM_STROKE_WIDTH}
                  strokeLinejoin="round"
                  opacity={0.4}
                />

                {/* Тонкое внутреннее кольцо вокруг центра */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={INNER_RING_R}
                  fill="none"
                  stroke="rgba(201, 169, 110, 0.35)"
                  strokeWidth={0.5}
                />

                {/* Центр: светящаяся точка интуиции + радиальные лучи */}
                <g filter="url(#centerGlowFilter)">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const end = polar(CX, CY, 16, deg);
                    return (
                      <line
                        key={deg}
                        x1={CX}
                        y1={CY}
                        x2={end.x}
                        y2={end.y}
                        stroke={ACCENT_GOLD}
                        strokeWidth={0.4}
                        opacity={0.4}
                      />
                    );
                  })}
                  <circle cx={CX} cy={CY} r="14" fill="url(#centerGlow)" />
                  <circle cx={CX} cy={CY} r="5" fill={ACCENT_GOLD} stroke="rgba(232, 220, 192, 0.9)" strokeWidth="0.5" />
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
