import { useState } from "react";

const SECTOR_COUNT = 9;
const SECTOR_ANGLE = 360 / SECTOR_COUNT; // 40°
const SPIN_DURATION_MS = 4200;
const NUMBERS = Array.from({ length: SECTOR_COUNT }, (_, index) => index + 1);

// Геометрия колеса (полярная система, центр — математически точный)
const CX = 50;
const CY = 50;
const RIM_OUTER_R = 52;
const WHEEL_OUTER_R = RIM_OUTER_R;
const RIM_INNER_R = 48;
const SEGMENT_BORDER_STROKE = 1.2;
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
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#5c6bc0", "#9b59b6", "#e91e63",
];

export default function App() {
  const [rotation, setRotation] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

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
              <svg
                className="wheel-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                {NUMBERS.map((n, i) => (
                  <path
                    key={i}
                    d={segmentPath(i)}
                    fill={SEGMENT_COLORS[i]}
                    stroke="#1a1a1a"
                    strokeWidth={SEGMENT_BORDER_STROKE}
                  />
                ))}
                <circle cx={CX} cy={CY} r="12" fill="#ffeb3b" stroke="#f9a825" strokeWidth="1" />
                {NUMBERS.map((n, i) => {
                  const pos = numberPosition(i, 33);
                  return (
                    <text
                      key={i}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize="7"
                      fontWeight="700"
                      fontFamily="system-ui, sans-serif"
                    >
                      {n}
                    </text>
                  );
                })}
                {/* Кольцо: один круг, fill none, stroke = толщина, stroke-linejoin round */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={RIM_MID_R}
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth={RIM_STROKE_WIDTH}
                  strokeLinejoin="round"
                />
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
