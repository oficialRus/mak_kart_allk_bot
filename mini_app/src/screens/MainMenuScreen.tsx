import type React from "react";

type MainMenuScreenProps = {
  onOpenDaily: () => void;
  onOpenAiCoach: () => void;
  onOpenCabinet: () => void;
  onOpenDigitalPsychologist: () => void;
  activeTab: "daily" | "menu" | "cabinet";
};

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onOpenDaily,
  onOpenAiCoach,
  onOpenCabinet,
  onOpenDigitalPsychologist,
  activeTab,
}) => {
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
                onClick={onOpenAiCoach}
              >
                Практики
              </button>
              <button
                type="button"
                className="main-menu-item"
                onClick={onOpenDigitalPsychologist}
              >
                Цифровой психолог
              </button>
              <button
                type="button"
                className="main-menu-item"
                onClick={() => {
                  // Обучение — пока заглушка, позже можно добавить переход.
                }}
              >
                Обучение
              </button>
              <button
                type="button"
                className="main-menu-item"
                onClick={() => {
                  // Магазин — пока заглушка, позже можно добавить переход.
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
            className={`bottom-nav-button bottom-nav-button--primary ${
              activeTab === "daily" ? "bottom-nav-button--active" : ""
            }`}
            onClick={onOpenDaily}
          >
            Цифра дня
          </button>
          <button
            type="button"
            className={`bottom-nav-button bottom-nav-button--menu ${
              activeTab === "menu" ? "bottom-nav-button--active" : ""
            }`}
            onClick={() => {
              // уже на главном меню — ничего не делаем
            }}
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
    </main>
  );
};

export default MainMenuScreen;

