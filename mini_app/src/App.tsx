import { useEffect, useState } from "react";
import { expandViewport, requestFullscreen } from "@telegram-apps/sdk";

const SECTOR_COUNT = 9;
const SECTOR_ANGLE = 360 / SECTOR_COUNT; // 40°
const SPIN_DURATION_MS = 4200;
const NUMBERS = Array.from({ length: SECTOR_COUNT }, (_, index) => index + 1);

// Геометрия колеса (полярная система, центр — математически точный)
const CX = 50;
const CY = 50;
const RIM_OUTER_R = 48;
const WHEEL_OUTER_R = RIM_OUTER_R;
const RIM_INNER_R = 42;
const SEGMENT_BORDER_STROKE = 0.6;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Полярные → декартовы (0° = право, угол против часовой)
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/**
 * Истинный круговой сектор: два радиальных отрезка от центра + одна внешняя дуга (SVG A).
 * Угол сектора 40°, один центр (cx,cy), один внешний радиус для всех. Без Bezier.
 */
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

// Кольцо обводкой: один круг, stroke = толщина кольца, центр = центр колеса
const RIM_MID_R = (RIM_INNER_R + RIM_OUTER_R) / 2;
const RIM_STROKE_WIDTH = RIM_OUTER_R - RIM_INNER_R;

const SEGMENT_COLORS = [
  "#111827",
  "#0f172a",
  "#1e293b",
  "#020617",
  "#111827",
  "#0b1220",
  "#020617",
  "#111827",
  "#1e293b",
];

const NUMBER_COLOR = "#F5E6C8"; // тёплый беж
const ACCENT_GOLD = "#C9A96E";

const TICK_INNER_R = 46;
const TICK_OUTER_R = 48;

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
          viewport?: {
            isExpanded?: boolean;
          };
        };
      };
    };

    const webApp = w.Telegram?.WebApp;
    if (!webApp) {
      // Если мини‑приложение открыто не через Telegram, пробуем только SDK.
      if (expandViewport.isAvailable()) {
        expandViewport();
      }
      (async () => {
        if (requestFullscreen.isAvailable()) {
          try {
            await requestFullscreen();
          } catch {
            // ignore
          }
        }
      })();
      return;
    }

    try {
      webApp.ready?.();
      if (!webApp.viewport?.isExpanded) {
        webApp.expand?.();
      }
      // Дополнительно просим полноэкранный режим через SDK, если доступно.
      if (expandViewport.isAvailable()) {
        expandViewport();
      }
      (async () => {
        if (requestFullscreen.isAvailable()) {
          try {
            await requestFullscreen();
          } catch {
            // ignore
          }
        }
      })();
    } catch {
      // игнорируем ошибки и продолжаем работу мини‑приложения
    }
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
              <svg className="wheel-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#F5E6C8" stopOpacity="0.9" />
                    <stop offset="45%" stopColor="#C9A96E" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {NUMBERS.map((n, i) => (
                  <path
                    key={i}
                    d={segmentPath(i)}
                    fill={SEGMENT_COLORS[i]}
                    stroke="rgba(148, 163, 184, 0.15)"
                    strokeWidth={SEGMENT_BORDER_STROKE}
                  />
                ))}

                {/* Тонкие разделители‑тики по окружности */}
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
                      stroke="rgba(148, 163, 184, 0.4)"
                      strokeWidth={0.4}
                    />
                  );
                })}

                {/* Числа по окружности */}
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

                {/* Внешнее тонкое кольцо‑рамка */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={RIM_MID_R}
                  fill="none"
                  stroke={ACCENT_GOLD}
                  strokeWidth={RIM_STROKE_WIDTH}
                  strokeLinejoin="round"
                  opacity={0.6}
                />

                {/* Мягкое свечение в центре — «интуиция» */}
                <circle cx={CX} cy={CY} r="18" fill="url(#centerGlow)" opacity={0.85} />
                <circle cx={CX} cy={CY} r="6" fill={ACCENT_GOLD} stroke="#fefce8" strokeWidth="0.6" />
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
