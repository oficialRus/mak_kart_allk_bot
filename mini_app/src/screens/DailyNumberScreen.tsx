import type React from "react";
import CardStarAtmosphere from "../components/CardStarAtmosphere";

const SECTOR_COUNT = 9;
const SECTOR_ANGLE = 360 / SECTOR_COUNT;

// Геометрия компаса (полярная система)
const CX = 50;
const CY = 50;
const RIM_OUTER_R = 48;
const WHEEL_OUTER_R = RIM_OUTER_R;
const INNER_RING_R = 20;
const CENTER_CORE_RING_R = 11;
const NUMBER_RADIUS = 26;
const TICK_INNER_R = 46.2;
const TICK_OUTER_R = 47.8;
const OUTER_RING_R = 47.8;
const OUTER_RING_STROKE = 0.85;

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

const NUMBERS = Array.from({ length: SECTOR_COUNT }, (_, index) => index + 1);

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

type DailyNumberScreenProps = {
  showCompass: boolean;
  rotation: number;
  isSpinning: boolean;
  hasResult: boolean;
  resultNumber: string | number;
  dailyMessage: string | null;
  showBirthSpreadModal: boolean;
  onSpin: () => void;
  onResetProfile: () => void;
  onOpenMenu: () => void;
  onOpenCabinet: () => void;
  onOpenBirthSpreadModal: () => void;
  onCloseBirthSpreadModal: () => void;
  activeTab: "daily" | "menu" | "cabinet";
};

const DailyNumberScreen: React.FC<DailyNumberScreenProps> = ({
  showCompass,
  rotation,
  isSpinning,
  hasResult,
  resultNumber,
  dailyMessage,
  showBirthSpreadModal,
  onSpin,
  onResetProfile,
  onOpenMenu,
  onOpenCabinet,
  onOpenBirthSpreadModal,
  onCloseBirthSpreadModal,
  activeTab,
}) => {
  return (
    <main className="page">
      <header className="app-header">
        <img src="/api/card-image?name=logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>

      <div className="page-inner">
        <div className="page-main">
          {showCompass && (
            <section className="roulette-card roulette-card--stars">
              <CardStarAtmosphere />
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
                          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                            <stop offset="35%" stopColor={ACCENT_GOLD} stopOpacity="0.35" />
                            <stop offset="65%" stopColor={ACCENT_GOLD} stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                          </radialGradient>
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

                        {NUMBERS.map((n, i) => (
                          <path
                            key={i}
                            d={segmentPath(i)}
                            fill={`url(#segmentGrad-${i})`}
                            stroke="rgba(37, 99, 235, 0.12)"
                            strokeWidth={0.25}
                          />
                        ))}

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
                              stroke="rgba(29, 78, 216, 0.45)"
                              strokeWidth={0.4}
                            />
                          );
                        })}

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

                        <circle
                          cx={CX}
                          cy={CY}
                          r={INNER_RING_R}
                          fill="none"
                          stroke="rgba(37, 99, 235, 0.28)"
                          strokeWidth={0.45}
                        />

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
                              fill="rgba(15, 23, 42, 0.75)"
                              fontSize="4.6"
                              fontWeight="600"
                              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                              letterSpacing="0.08em"
                            >
                              {dir.label}
                            </text>
                          );
                        })}

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
                            stroke="#ffffff"
                            strokeWidth="0.45"
                          />
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <button className={`spin-button ${isSpinning ? "loading" : ""}`} onClick={onSpin} disabled={isSpinning}>
                {isSpinning ? "Крутим..." : "Крутить"}
              </button>

              {hasResult && (
                <div className="result-text">
                  <p className="result-title">Ваша цифра дня: {resultNumber}</p>
                  <p className="result-description">
                    {`Описание: сегодня число ${resultNumber} подсказывает держать курс на приоритеты и не распыляться.`}
                  </p>
                  {dailyMessage && (
                    <p className="result-daily-message">
                      <span className="result-daily-message__label">Послание на день</span>
                      {dailyMessage}
                    </p>
                  )}
                </div>
              )}
              <button type="button" className="reset-link" onClick={onResetProfile}>
                /delete — очистить локальные данные
              </button>
            </section>
          )}
        </div>

        <nav className="bottom-nav">
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--primary ${
              activeTab === "daily" ? "bottom-nav-button--active" : ""
            }`}
            onClick={() => {
              // просто остаёмся на экране «Цифра дня»
            }}
          >
            ВАША ЦИФРА ДНЯ
          </button>
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--menu ${
              activeTab === "menu" ? "bottom-nav-button--active" : ""
            }`}
            onClick={onOpenMenu}
          >
            Меню
          </button>
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--primary ${
              activeTab === "cabinet" ? "bottom-nav-button--active" : ""
            }`}
            onClick={onOpenCabinet}
          >
            Личный кабинет
          </button>
        </nav>
      </div>

      {showBirthSpreadModal && (
        <div className="modal-overlay" onClick={onCloseBirthSpreadModal} aria-hidden="false">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={onCloseBirthSpreadModal}
              aria-label="Закрыть"
            >
              ×
            </button>
            <p className="modal-text">
              Расклад по дате рождения делается в приложении: «Меню» → «ИИ психолог коуч» → «Ваш психологический код по дате
              рождения». Там вы введите имя и дату только для этого разбора.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-close-app-btn"
                onClick={() => {
                  onCloseBirthSpreadModal();
                  onOpenMenu();
                }}
              >
                Перейти в меню
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default DailyNumberScreen;

