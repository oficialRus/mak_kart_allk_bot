import React from "react";
import CardStarAtmosphere from "../components/CardStarAtmosphere";

type CabinetMenuScreenProps = {
  onOpenDaily: () => void;
  onOpenMenu: () => void;
  onOpenMyReviews: () => void;
  onLogout: () => void;
  activeTab: "daily" | "menu" | "cabinet";
};

const CabinetMenuScreen: React.FC<CabinetMenuScreenProps> = ({
  onOpenDaily,
  onOpenMenu,
  onOpenMyReviews,
  onLogout,
  activeTab,
}) => {
  return (
    <main className="page">
      <header className="app-header">
        <img src="/api/card-image?name=logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue">
        <div className="page-main">
          <section className="roulette-card onboarding-card roulette-card--stars">
            <CardStarAtmosphere />
            <h1 className="onboarding-title">Личный кабинет</h1>
            <p className="onboarding-subtitle">Разделы, которые касаются сохранённых материалов.</p>
            <div className="main-menu-list">
              <button type="button" className="main-menu-item" onClick={onOpenMyReviews}>
                Мои разборы
              </button>
              <button type="button" className="main-menu-item main-menu-item--logout" onClick={onLogout}>
                Выйти
              </button>
            </div>
            <p className="technique-body" style={{ marginTop: "0.75rem", fontSize: "0.88rem", color: "var(--text-muted)" }}>
              Имя и дата рождения для расчётов вводятся в разделе «Психологический код по дате рождения» в меню — только для
              конкретного разбора, не как данные профиля здесь.
            </p>
          </section>
        </div>
        <nav className="bottom-nav">
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--primary ${
              activeTab === "daily" ? "bottom-nav-button--active" : ""
            }`}
            onClick={onOpenDaily}
          >
            ВАША ЦИФРА ДНЯ
          </button>
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--menu ${activeTab === "menu" ? "bottom-nav-button--active" : ""}`}
            onClick={onOpenMenu}
          >
            Меню
          </button>
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--primary ${
              activeTab === "cabinet" ? "bottom-nav-button--active" : ""
            }`}
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
};

export default CabinetMenuScreen;
