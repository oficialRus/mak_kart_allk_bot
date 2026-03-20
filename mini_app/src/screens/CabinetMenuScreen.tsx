import React, { useEffect, useState } from "react";
import CardStarAtmosphere from "../components/CardStarAtmosphere";

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
  onSaveMyData: (data: { fullName: string; birthDate: string }) => Promise<{ ok: boolean; error?: string }>;
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
  onSaveMyData,
  activeTab,
}) => {
  const [isEditingMyData, setIsEditingMyData] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!myData) return;
    setEditFullName(myData.fullName || "");
    setEditBirthDate(myData.birthDate || "");
  }, [myData]);

  return (
    <main className="page">
      <header className="app-header">
        <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue">
        <div className="page-main">
          <section className="roulette-card onboarding-card roulette-card--stars">
            <CardStarAtmosphere />
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
            {saveError && <p className="dialog-error">{saveError}</p>}
            {!myDataLoading && !myDataError && myData && (
              <div className="technique-text">
                <h2 className="technique-title">Ваши данные</h2>
                {!isEditingMyData ? (
                  <>
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
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSaveError(null);
                        setEditFullName(myData.fullName || "");
                        setEditBirthDate(myData.birthDate || "");
                        setIsEditingMyData(true);
                      }}
                    >
                      Редактировать данные
                    </button>
                  </>
                ) : (
                  <form
                    className="onboarding-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (saveLoading) return;
                      setSaveError(null);
                      setSaveLoading(true);
                      const res = await onSaveMyData({
                        fullName: editFullName,
                        birthDate: editBirthDate,
                      });
                      setSaveLoading(false);
                      if (!res.ok) {
                        setSaveError(res.error || "Не удалось сохранить данные. Попробуйте ещё раз.");
                        return;
                      }
                      setIsEditingMyData(false);
                    }}
                  >
                    <label className="onboarding-field">
                      <span className="onboarding-label">ФИО</span>
                      <input
                        type="text"
                        className="onboarding-input"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        placeholder="Фамилия Имя Отчество"
                      />
                    </label>
                    <label className="onboarding-field">
                      <span className="onboarding-label">Дата рождения</span>
                      <input
                        type="text"
                        className="onboarding-input"
                        value={editBirthDate}
                        onChange={(e) => setEditBirthDate(e.target.value)}
                        placeholder="ДД.ММ.ГГГГ"
                      />
                    </label>
                    <button type="submit" className="spin-button" disabled={saveLoading}>
                      {saveLoading ? "Сохраняем..." : "Сохранить"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSaveError(null);
                        setIsEditingMyData(false);
                      }}
                    >
                      Отмена
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
        <nav className={`bottom-nav ${isEditingMyData ? "bottom-nav--hidden" : ""}`}>
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

