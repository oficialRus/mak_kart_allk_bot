import type React from "react";

type CabinetMenuScreenProps = {
  onOpenDaily: () => void;
  onOpenMenu: () => void;
  onShowMyData: () => void;
  myData?: {
    fullName: string;
    birthDate: string;
    phone?: string;
  } | null;
  myDataLoading: boolean;
  myDataError: string | null;
  onOpenMyReviews: () => void;
  activeTab: "daily" | "menu" | "cabinet";
};

const CabinetMenuScreen: React.FC<CabinetMenuScreenProps> = ({
  onOpenDaily,
  onOpenMenu,
  onShowMyData,
  myData,
  myDataLoading,
  myDataError,
  onOpenMyReviews,
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
            <h1 className="onboarding-title">Личный кабинет</h1>
            <p className="onboarding-subtitle">Что вы хотите открыть сейчас?</p>
            <div className="main-menu-list">
              <button
                type="button"
                className="main-menu-item"
                onClick={onShowMyData}
              >
                Мои данные
              </button>
              <button
                type="button"
                className="main-menu-item"
                onClick={onOpenMyReviews}
              >
                Мои разборы
              </button>
            </div>
            {myDataLoading && <p className="technique-body">Загружаем ваши данные…</p>}
            {myDataError && <p className="dialog-error">{myDataError}</p>}
            {!myDataLoading && !myDataError && myData && (
              <div className="technique-text">
                <h2 className="technique-title">Ваши данные</h2>
                <p className="technique-body">
                  <strong>ФИО:</strong> {myData.fullName || "—"}
                  <br />
                  <strong>Дата рождения:</strong> {myData.birthDate || "—"}
                  {typeof myData.phone === "string" && myData.phone.trim() && (
                    <>
                      <br />
                      <strong>Телефон:</strong> {myData.phone}
                    </>
                  )}
                </p>
              </div>
            )}
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

