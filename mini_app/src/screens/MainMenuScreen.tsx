import React, { useState } from "react";
import CardStarAtmosphere from "../components/CardStarAtmosphere";

type MainMenuScreenProps = {
  onOpenDaily: () => void;
  onOpenAiCoach: () => void;
  onOpenCabinet: () => void;
  onOpenDigitalPsychologist: () => void;
  activeTab: "daily" | "menu" | "cabinet";
};

type LearningView = "menu" | "intro" | "survey" | "afterSurvey" | "modules";

type SurveyLevel = "novice" | "experienced";
type SurveyGoal = "self" | "answers" | "practice";
type SurveyFormat = "cards" | "numbers" | "both";

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onOpenDaily,
  onOpenAiCoach,
  onOpenCabinet,
  onOpenDigitalPsychologist,
  activeTab,
}) => {
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const [learningView, setLearningView] = useState<LearningView>("menu");
  const [surveyLevel, setSurveyLevel] = useState<SurveyLevel | null>(null);
  const [surveyGoal, setSurveyGoal] = useState<SurveyGoal | null>(null);
  const [surveyFormat, setSurveyFormat] = useState<SurveyFormat | null>(null);

  const surveyComplete = surveyLevel != null && surveyGoal != null && surveyFormat != null;

  const resetLearning = () => {
    setLearningView("menu");
    setSurveyLevel(null);
    setSurveyGoal(null);
    setSurveyFormat(null);
  };

  const levelLabel = (v: SurveyLevel) =>
    v === "novice" ? "Новичок" : "Уже есть опыт";
  const goalLabel = (v: SurveyGoal) =>
    v === "self" ? "Разобраться в себе" : v === "answers" ? "Получить ответы" : "Регулярная практика";
  const formatLabel = (v: SurveyFormat) =>
    v === "cards" ? "Карты" : v === "numbers" ? "Цифры" : "Всё вместе";

  return (
    <main className="page">
      <header className="app-header">
        <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue">
        <div className="page-main">
          <section className="roulette-card onboarding-card roulette-card--stars">
            {learningView === "menu" && <CardStarAtmosphere />}
            {learningView === "menu" && (
              <>
                <h1 className="onboarding-title">Меню</h1>
                <p className="onboarding-subtitle">Выберите раздел, с которого хотите начать.</p>
                <div className="main-menu-list">
                  <button type="button" className="main-menu-item" onClick={onOpenAiCoach}>
                    Практики
                  </button>
                  <button type="button" className="main-menu-item" onClick={onOpenDigitalPsychologist}>
                    ИИ психолог коуч
                  </button>
                  <button type="button" className="main-menu-item" onClick={() => setLearningView("intro")}>
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
                  <button type="button" className="main-menu-item" onClick={() => setShowFeedbackMenu((p) => !p)}>
                    Обратная связь
                  </button>
                </div>
                {showFeedbackMenu && (
                  <div className="feedback-card">
                    <h2 className="feedback-card__title">Обратная связь</h2>
                    <div className="feedback-card__list">
                      <button
                        type="button"
                        className="feedback-card__item"
                        onClick={() => {
                          try {
                            const w = window as unknown as {
                              Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } };
                            };
                            const url = "https://t.me/RyslanNovikov";
                            if (w.Telegram?.WebApp?.openTelegramLink) {
                              w.Telegram.WebApp.openTelegramLink(url);
                            } else {
                              window.open(url, "_blank");
                            }
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <span className="feedback-card__icon">✉️</span>
                        <span className="feedback-card__label">Написать в Telegram</span>
                      </button>
                      <button
                        type="button"
                        className="feedback-card__item"
                        onClick={() => {
                          try {
                            window.open("https://vk.com/garmonia_mak", "_blank");
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <span className="feedback-card__icon">🌀</span>
                        <span className="feedback-card__label">Написать во ВКонтакте</span>
                      </button>
                      <button
                        type="button"
                        className="feedback-card__item"
                        onClick={() => {
                          try {
                            window.location.href = "mailto:garmonia-mak@yandex.ru";
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <span className="feedback-card__icon">📧</span>
                        <span className="feedback-card__label">Почта: garmonia-mak@yandex.ru</span>
                      </button>
                    </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowFeedbackMenu(false)}
                >
                  Закрыть
                </button>
                  </div>
                )}
              </>
            )}

            {learningView === "intro" && (
              <>
                <h1 className="onboarding-title">Обучение</h1>
                <p className="learning-intro-text">
                  Здесь вы сможете пройти короткий опрос — мы поймём ваш уровень и цели, чтобы предложить удобный формат:
                  карты, личная цифра или сочетание практик. Это займёт около минуты.
                </p>
                <button type="button" className="spin-button learning-cta" onClick={() => setLearningView("survey")}>
                  👉 Пройти короткий опрос
                </button>
                <button type="button" className="secondary-button" onClick={resetLearning}>
                  ⬅️ Назад в меню
                </button>
              </>
            )}

            {learningView === "survey" && (
              <>
                <h1 className="onboarding-title">Короткий опрос</h1>
                <p className="onboarding-subtitle">Отметьте варианты, которые вам ближе всего.</p>

                <div className="learning-survey">
                  <div className="learning-survey-block">
                    <h2 className="learning-survey-label">Ваш уровень</h2>
                    <div className="learning-survey-options">
                      <button
                        type="button"
                        className={`learning-option ${surveyLevel === "novice" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyLevel("novice")}
                      >
                        Новичок
                      </button>
                      <button
                        type="button"
                        className={`learning-option ${surveyLevel === "experienced" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyLevel("experienced")}
                      >
                        Уже есть опыт
                      </button>
                    </div>
                  </div>

                  <div className="learning-survey-block">
                    <h2 className="learning-survey-label">Главная цель</h2>
                    <div className="learning-survey-options learning-survey-options--stack">
                      <button
                        type="button"
                        className={`learning-option ${surveyGoal === "self" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyGoal("self")}
                      >
                        Разобраться в себе
                      </button>
                      <button
                        type="button"
                        className={`learning-option ${surveyGoal === "answers" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyGoal("answers")}
                      >
                        Получить ответы на вопросы
                      </button>
                      <button
                        type="button"
                        className={`learning-option ${surveyGoal === "practice" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyGoal("practice")}
                      >
                        Регулярная практика
                      </button>
                    </div>
                  </div>

                  <div className="learning-survey-block">
                    <h2 className="learning-survey-label">Интересующий формат</h2>
                    <div className="learning-survey-options">
                      <button
                        type="button"
                        className={`learning-option ${surveyFormat === "cards" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyFormat("cards")}
                      >
                        Карты
                      </button>
                      <button
                        type="button"
                        className={`learning-option ${surveyFormat === "numbers" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyFormat("numbers")}
                      >
                        Цифры
                      </button>
                      <button
                        type="button"
                        className={`learning-option ${surveyFormat === "both" ? "learning-option--active" : ""}`}
                        onClick={() => setSurveyFormat("both")}
                      >
                        Всё вместе
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="spin-button learning-cta"
                  disabled={!surveyComplete}
                  onClick={() => setLearningView("afterSurvey")}
                >
                  Завершить опрос
                </button>
                <button type="button" className="secondary-button" onClick={() => setLearningView("intro")}>
                  ⬅️ Назад
                </button>
              </>
            )}

            {learningView === "afterSurvey" && surveyComplete && (
              <>
                <h1 className="onboarding-title">Спасибо!</h1>
                <p className="learning-intro-text">
                  Мы учли ваши ответы. Ниже — краткое резюме; дальше откроются разделы обучения.
                </p>
                <div className="learning-summary">
                  <p>
                    <span className="learning-summary-key">Уровень:</span> {levelLabel(surveyLevel)}
                  </p>
                  <p>
                    <span className="learning-summary-key">Цель:</span> {goalLabel(surveyGoal)}
                  </p>
                  <p>
                    <span className="learning-summary-key">Формат:</span> {formatLabel(surveyFormat)}
                  </p>
                </div>
                <button type="button" className="spin-button learning-cta" onClick={() => setLearningView("modules")}>
                  👉 Перейти к обучению
                </button>
                <button type="button" className="secondary-button" onClick={() => setLearningView("survey")}>
                  ⬅️ Изменить ответы
                </button>
              </>
            )}

            {learningView === "modules" && (
              <>
                <h1 className="onboarding-title">Обучение</h1>
                <p className="onboarding-subtitle">Выберите раздел — начните с того, что откликается сильнее.</p>
                <div className="learning-cubes">
                  <button type="button" className="learning-cube learning-cube--soon" disabled>
                    <span className="learning-cube__icon" aria-hidden>
                      ✨
                    </span>
                    <span className="learning-cube__title">Обучение с ИИ</span>
                    <span className="learning-cube__hint">Скоро появится в приложении</span>
                  </button>
                  <button
                    type="button"
                    className="learning-cube"
                    onClick={() => {
                      try {
                        window.open("https://www.garmonia-mak.ru/", "_blank");
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <span className="learning-cube__icon" aria-hidden>
                      📚
                    </span>
                    <span className="learning-cube__title">База знаний</span>
                    <span className="learning-cube__hint">Материалы и статьи на сайте проекта</span>
                  </button>
                  <button type="button" className="learning-cube learning-cube--soon" disabled>
                    <span className="learning-cube__icon" aria-hidden>
                      ▶️
                    </span>
                    <span className="learning-cube__title">Видео уроки</span>
                    <span className="learning-cube__hint">Скоро появятся в приложении</span>
                  </button>
                </div>
                <button type="button" className="secondary-button" onClick={resetLearning}>
                  ⬅️ Назад в меню
                </button>
              </>
            )}
          </section>
        </div>
        {learningView === "menu" && (
          <div className="page-main-image">
            <img src="/main-menu-bottom.png" alt="Гармония-МАК — самопознание" className="page-main-image__img" />
          </div>
        )}
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
              if (learningView !== "menu") resetLearning();
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
