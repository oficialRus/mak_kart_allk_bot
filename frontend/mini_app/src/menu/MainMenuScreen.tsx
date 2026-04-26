import React, { useEffect, useState } from "react";
import CardStarAtmosphere from "../components/CardStarAtmosphere";
import { MainMenuBottomAnimated } from "../design/DesignforMainPage";
import { openExternalLink, openTelegramLink } from "../runtime";

type MainMenuScreenProps = {
  onOpenDaily: () => void;
  onOpenCabinet: () => void;
  onOpenAiCoach: () => void;
  onOpenDigitalPsychologist: () => void;
  autoOpenLearning: boolean;
  onLearningAutoOpened: () => void;
  learningSurvey: {
    level: SurveyLevel;
    goal: SurveyGoal;
    format: SurveyFormat;
  } | null;
  onSaveLearningSurvey: (payload: { level: SurveyLevel; goal: SurveyGoal; format: SurveyFormat }) => Promise<boolean>;
};

type LearningView = "menu" | "intro" | "survey" | "afterSurvey" | "modules";

type SurveyLevel = "novice" | "experienced";
type SurveyGoal = "self" | "answers" | "practice";
type SurveyFormat = "cards" | "numbers" | "both";

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onOpenDaily,
  onOpenCabinet,
  onOpenAiCoach,
  onOpenDigitalPsychologist,
  autoOpenLearning,
  onLearningAutoOpened,
  learningSurvey,
  onSaveLearningSurvey,
}) => {
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [learningView, setLearningView] = useState<LearningView>("menu");
  const [surveyLevel, setSurveyLevel] = useState<SurveyLevel | null>(learningSurvey?.level ?? null);
  const [surveyGoal, setSurveyGoal] = useState<SurveyGoal | null>(learningSurvey?.goal ?? null);
  const [surveyFormat, setSurveyFormat] = useState<SurveyFormat | null>(learningSurvey?.format ?? null);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [surveySaveError, setSurveySaveError] = useState<string | null>(null);

  const surveyComplete = surveyLevel != null && surveyGoal != null && surveyFormat != null;
  const hasSavedSurvey = learningSurvey != null;

  useEffect(() => {
    setSurveyLevel(learningSurvey?.level ?? null);
    setSurveyGoal(learningSurvey?.goal ?? null);
    setSurveyFormat(learningSurvey?.format ?? null);
  }, [learningSurvey]);

  useEffect(() => {
    if (!autoOpenLearning) return;
    setSurveySaveError(null);
    setLearningView(hasSavedSurvey ? "afterSurvey" : "intro");
    onLearningAutoOpened();
  }, [autoOpenLearning, hasSavedSurvey, onLearningAutoOpened]);

  const resetLearning = () => {
    setLearningView("menu");
    setSurveyLevel(learningSurvey?.level ?? null);
    setSurveyGoal(learningSurvey?.goal ?? null);
    setSurveyFormat(learningSurvey?.format ?? null);
    setSurveySaveError(null);
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
        <img src="/api/card-image?name=logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue page-inner--menu">
        <section className="roulette-card onboarding-card roulette-card--stars">
            {learningView === "menu" && (
              <>
                <CardStarAtmosphere className="main-menu-top-atmosphere" />
                <h1 className="onboarding-title">{showShop ? "Магазин" : "Главное меню"}</h1>
                <p className="onboarding-subtitle onboarding-subtitle--menu-accent">
                  {showShop ? "Выберите набор карт, который хотите оформить на Ozon или WB." : "Выберите раздел, с которого хотите начать."}
                </p>

                {!showShop && (
                  <div className="main-menu-list">
                    <button type="button" className="main-menu-item" onClick={onOpenDigitalPsychologist}>
                      ИИ психолог коуч
                    </button>
                    <button type="button" className="main-menu-item" onClick={onOpenAiCoach}>
                      Практики
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => {
                        setShowFeedbackMenu(false);
                        setShowShop(true);
                      }}
                    >
                      Магазин
                    </button>
                    <button
                      type="button"
                      className="main-menu-item"
                      onClick={() => setShowFeedbackMenu((p) => !p)}
                    >
                      Обратная связь
                    </button>
                  </div>
                )}

                {showShop && (
                  <div className="shop-list">
                    <article className="shop-card">
                      <div className="shop-card__media" aria-hidden>
                        <img
                          src="/api/card-image?name=ya-vybirayu-byt.png"
                          alt="Метафорические карты Я выбираю быть"
                          className="shop-card__image"
                        />
                      </div>
                      <div className="shop-card__content">
                        <h2 className="shop-card__title">
                          Оживающие МАК
                          <span className="shop-card__title-sub">«Я выбираю быть»</span>
                        </h2>
                        <p className="shop-card__description">
                          Метафорические оживающие карты «Я выбираю быть» — это инструмент для самопознания и
                          внутреннего роста. 50 карт с видео и посланиями помогают лучше понять себя, услышать
                          интуицию и находить ответы в повседневной жизни. Подходят для ежедневных практик, размышлений
                          и принятия решений.
                        </p>
                        <div className="shop-card__actions">
                          <button
                            type="button"
                            className="spin-button shop-card__buy-button"
                            onClick={() => {
                              openExternalLink(
                                "https://www.ozon.ru/product/universalnye-metaforicheskie-assotsiativnye-karty-mak-ya-vybirayu-byt-50-kart-3849189250/",
                              );
                            }}
                          >
                            Купить на Ozon
                          </button>
                          <button
                            type="button"
                            className="spin-button shop-card__buy-button shop-card__buy-button--wb"
                            onClick={() => {
                              try {
                                window.open("https://www.wildberries.ru/catalog/941128748/detail.aspx?targetUrl=GP", "_blank");
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Купить на WB
                          </button>
                        </div>
                      </div>
                    </article>

                    <article className="shop-card">
                      <div className="shop-card__media" aria-hidden>
                        <img
                          src="/api/card-image?name=garmoniya-dnya.png"
                          alt="Метафорические карты Гармония дня"
                          className="shop-card__image"
                        />
                      </div>
                      <div className="shop-card__content">
                        <h2 className="shop-card__title">
                          Оживающие МАК
                          <span className="shop-card__title-sub">«ГАРМОНИЯ ДНЯ»</span>
                        </h2>
                        <p className="shop-card__description">
                          Метафорические оживающие карты «Гармония дня» — инструмент для самопознания и внутреннего
                          баланса. 50 карт с видео и посланиями помогают понять себя, услышать интуицию и находить ответы
                          каждый день. Подходят для размышлений, медитаций и принятия решений.
                        </p>
                        <div className="shop-card__actions">
                          <button
                            type="button"
                            className="spin-button shop-card__buy-button"
                            onClick={() => {
                              openExternalLink("https://www.ozon.ru/product/3849175875/");
                            }}
                          >
                            Купить на Ozon
                          </button>
                          <button
                            type="button"
                            className="spin-button shop-card__buy-button shop-card__buy-button--wb"
                            onClick={() => {
                              try {
                                window.open("https://www.wildberries.ru/catalog/836082248/detail.aspx?targetUrl=GP", "_blank");
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Купить на WB
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                )}

                {showFeedbackMenu && !showShop && (
                  <div className="feedback-card">
                    <h2 className="feedback-card__title">Обратная связь</h2>
                    <div className="feedback-card__list">
                      <button
                        type="button"
                        className="feedback-card__item"
                        onClick={() => {
                          openTelegramLink("https://t.me/RyslanNovikov");
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
                {learningView === "menu" && (
                  <div className="main-menu-bottom-inline">
                    <CardStarAtmosphere />
                    <MainMenuBottomAnimated />
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
                  onClick={async () => {
                    if (!surveyComplete || !surveyLevel || !surveyGoal || !surveyFormat || savingSurvey) return;
                    setSavingSurvey(true);
                    setSurveySaveError(null);
                    const ok = await onSaveLearningSurvey({
                      level: surveyLevel,
                      goal: surveyGoal,
                      format: surveyFormat,
                    });
                    setSavingSurvey(false);
                    if (!ok) {
                      setSurveySaveError("Не удалось сохранить результаты опроса. Попробуйте ещё раз.");
                      return;
                    }
                    setLearningView("afterSurvey");
                  }}
                >
                  {savingSurvey ? "Сохраняем..." : "Завершить опрос"}
                </button>
                {surveySaveError && <p className="dialog-error">{surveySaveError}</p>}
                <button type="button" className="secondary-button" onClick={() => setLearningView("intro")}>
                  ⬅️ Назад
                </button>
                <button type="button" className="secondary-button" onClick={resetLearning}>
                  Главное меню
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
        {false && (
          <div className="page-main-image">
            {false && <img
              src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1NDAiIGhlaWdodD0iNTQwIiB2aWV3Qm94PSIwIDAgNTQwIDU0MCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwNjEwMmEiIC8+PHN0b3Agb2Zmc2V0PSI2MCUiIHN0b3AtY29sb3I9IiMwMjAzMGEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMDEwMTBhIiAvPjwvbGluZWFyR3JhZGllbnQ+PHJhZGlhbEdyYWRpZW50IGlkPSJ2aWduZXR0ZSIgY3g9IjUwJSIgY3k9IjQwJSIgcj0iNzAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMGIxZjRhIiBzdG9wLW9wYWNpdHk9IjAuMTgiIC8+PHN0b3Agb2Zmc2V0PSI1NSUiIHN0b3AtY29sb3I9IiMwYjFmNGEiIHN0b3Atb3BhY2l0eT0iMC4wNSIgLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwMDAwMDAiIHN0b3Atb3BhY2l0eT0iMC40OCIgLz48L3JhZGlhbEdyYWRpZW50PjxmaWx0ZXIgaWQ9InRleHRHbG93IiB4PSItMzAlIiB5PSItMzAlIiB3aWR0aD0iMTYwJSIgaGVpZ2h0PSIxNjAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIyIiByZXN1bHQ9ImJsdXIiIC8+PGZlQ29sb3JNYXRyaXggaW49ImJsdXIiIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIxIDAgMCAwIDAgIDAgMSAwIDAgMCAgMCAwIDEgMCAwICAwIDAgMCAwLjU1IDAiIHJlc3VsdD0iZ2xvdyIgLz48ZmVNZXJnZT48ZmVNZXJnZU5vZGUgaW49Imdsb3ciIC8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIiAvPjwvZmVNZXJnZT48L2ZpbHRlcj48c3R5bGU+QGtleWZyYW1lcyB0d2lua2xlezAlLDEwMCV7b3BhY2l0eTowLjN9NTAle29wYWNpdHk6MX19LnN0YXJ7ZmlsbDojZjNlYWQwOyBhbmltYXRpb246dHdpbmtsZSBlYXNlLWluLW91dCBpbmZpbml0ZTt9PC9zdHlsZT48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNiZykiIC8+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCN2aWduZXR0ZSkiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjE3NC44NyIgY3k9IjgxLjQ2IiByPSIyLjA0IiBvcGFjaXR5PSIwLjU2IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuNTFzOyBhbmltYXRpb24tZGVsYXk6LTYuNTBzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzEuMzIiIGN5PSIyNzQuMDIiIHI9IjEuMDYiIG9wYWNpdHk9IjAuMzYiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246OC4wNHM7IGFuaW1hdGlvbi1kZWxheTotMTMuMDJzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMjI5LjI0IiBjeT0iNDQ2LjUwIiByPSIxLjIwIiBvcGFjaXR5PSIwLjk2IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjYuNTZzOyBhbmltYXRpb24tZGVsYXk6LTUuMjJzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzExLjY0IiBjeT0iMjE0LjIxIiByPSIyLjU2IiBvcGFjaXR5PSIwLjUwIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuMzNzOyBhbmltYXRpb24tZGVsYXk6LTEuOThzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNzcuOTAiIGN5PSI2My42MSIgcj0iMS40OSIgb3BhY2l0eT0iMC43MSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMC43MXM7IGFuaW1hdGlvbi1kZWxheTotMTEuNDdzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzQ1LjAxIiBjeT0iMjAxLjA5IiByPSIxLjg4IiBvcGFjaXR5PSIwLjQ0IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuNDRzOyBhbmltYXRpb24tZGVsYXk6LTEzLjE3czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjM2Ny40MiIgY3k9IjIzMC45MCIgcj0iMS41MCIgb3BhY2l0eT0iMC41MSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo5LjEwczsgYW5pbWF0aW9uLWRlbGF5Oi03LjY2czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjQyOC45NiIgY3k9IjM3Ny40NiIgcj0iMS4zOSIgb3BhY2l0eT0iMC45MSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo5LjAyczsgYW5pbWF0aW9uLWRlbGF5Oi02LjY1czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjM5My45MCIgY3k9IjE1NS40OSIgcj0iMi41NyIgb3BhY2l0eT0iMC44MyIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1LjgzczsgYW5pbWF0aW9uLWRlbGF5Oi04LjE1czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjgyLjA3IiBjeT0iMjY0LjA0IiByPSIxLjA2IiBvcGFjaXR5PSIwLjcwIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuNjhzOyBhbmltYXRpb24tZGVsYXk6LTMuMzBzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNDcyLjc2IiBjeT0iMTY5LjQyIiByPSIyLjExIiBvcGFjaXR5PSIwLjYyIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuMTZzOyBhbmltYXRpb24tZGVsYXk6LTUuODhzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNDUzLjU4IiBjeT0iNTEwLjEzIiByPSIxLjc2IiBvcGFjaXR5PSIwLjc5IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuNjVzOyBhbmltYXRpb24tZGVsYXk6LTEzLjE1czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjM0OS40NSIgY3k9IjUzNi4yNyIgcj0iMi4zMiIgb3BhY2l0eT0iMC43NyIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo2Ljk5czsgYW5pbWF0aW9uLWRlbGF5Oi04LjYwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjEyLjE4IiBjeT0iMjQ5LjMyIiByPSIxLjI3IiBvcGFjaXR5PSIwLjg0IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuODJzOyBhbmltYXRpb24tZGVsYXk6LTEzLjE3czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjY5Ljg0IiBjeT0iMTMzLjcxIiByPSIxLjYzIiBvcGFjaXR5PSIwLjYxIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjEwczsgYW5pbWF0aW9uLWRlbGF5Oi0xMi44N3M7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIyOTYuNzAiIGN5PSI0NzcuMDMiIHI9IjIuMzEiIG9wYWNpdHk9IjAuNTkiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTEuMDVzOyBhbmltYXRpb24tZGVsYXk6LTEwLjEwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjE5My43NCIgY3k9IjQ3Ny40NiIgcj0iMi41MyIgb3BhY2l0eT0iMC40NiIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo2LjA2czsgYW5pbWF0aW9uLWRlbGF5Oi0xMS41M3M7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIxMjYuMDAiIGN5PSIyNjEuODgiIHI9IjEuOTQiIG9wYWNpdHk9IjAuNTkiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ni44NHM7IGFuaW1hdGlvbi1kZWxheTotMTMuOTRzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTk5LjQwIiBjeT0iMzA1LjgyIiByPSIyLjUyIiBvcGFjaXR5PSIwLjczIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuODNzOyBhbmltYXRpb24tZGVsYXk6LTYuNzhzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzY1LjE1IiBjeT0iMjkuMTYiIHI9IjIuNDQiIG9wYWNpdHk9IjAuODYiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTAuNDZzOyBhbmltYXRpb24tZGVsYXk6LTEuNzZzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMjExLjg4IiBjeT0iMjE1LjQ1IiByPSIxLjE3IiBvcGFjaXR5PSIwLjM1IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuNDRzOyBhbmltYXRpb24tZGVsYXk6LTEzLjEzczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjExMi43MyIgY3k9Ijg3LjY0IiByPSIxLjU0IiBvcGFjaXR5PSIwLjQxIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuMzdzOyBhbmltYXRpb24tZGVsYXk6LTE0LjAwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjU0Ljc5IiBjeT0iMTk2LjM1IiByPSIxLjA0IiBvcGFjaXR5PSIwLjQwIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjEyczsgYW5pbWF0aW9uLWRlbGF5Oi01LjQwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjEzNi4yMiIgY3k9IjE4Ny41OSIgcj0iMS41OCIgb3BhY2l0eT0iMS4wMCIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1Ljg2czsgYW5pbWF0aW9uLWRlbGF5Oi0yLjExczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjI1MS42MyIgY3k9IjI2MS4yNyIgcj0iMS4xNCIgb3BhY2l0eT0iMC40OSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1LjcyczsgYW5pbWF0aW9uLWRlbGF5Oi05LjIwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjQ0Ny41OCIgY3k9Ijg3LjE4IiByPSIxLjA0IiBvcGFjaXR5PSIwLjQwIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjY2czsgYW5pbWF0aW9uLWRlbGF5Oi02LjYwczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjI5My4zMSIgY3k9IjE0LjYwIiByPSIxLjg0IiBvcGFjaXR5PSIwLjc5IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjg1czsgYW5pbWF0aW9uLWRlbGF5Oi0xLjkxczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjE0MS4wMCIgY3k9IjE5OC4wMiIgcj0iMS4yNyIgb3BhY2l0eT0iMC44NSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMC40MHM7IGFuaW1hdGlvbi1kZWxheTotNi41NHM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIxNzguMDIiIGN5PSIxMjAuNDQiIHI9IjIuMzAiIG9wYWNpdHk9IjAuODYiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTEuODlzOyBhbmltYXRpb24tZGVsYXk6LTIuMDZzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNDQxLjkwIiBjeT0iMzk5LjUzIiByPSIxLjM2IiBvcGFjaXR5PSIwLjMyIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjguNjJzOyBhbmltYXRpb24tZGVsYXk6LTkuMDJzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTUuMDkiIGN5PSIxNTAuODkiIHI9IjEuNDEiIG9wYWNpdHk9IjAuNjEiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246OS44NXM7IGFuaW1hdGlvbi1kZWxheTotMC42MXM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI1MDUuOTkiIGN5PSI1MzMuNTQiIHI9IjIuNTMiIG9wYWNpdHk9IjAuNDYiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ny41NXM7IGFuaW1hdGlvbi1kZWxheTotMTAuOTFzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTA2LjIyIiBjeT0iMTEwLjM2IiByPSIyLjAwIiBvcGFjaXR5PSIwLjY0IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjMwczsgYW5pbWF0aW9uLWRlbGF5Oi0yLjIzczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjM1Mi42MSIgY3k9IjQzMS44MSIgcj0iMS4xNCIgb3BhY2l0eT0iMC44NSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo5LjYyczsgYW5pbWF0aW9uLWRlbGF5Oi0xLjI2czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjQwNS4wOCIgY3k9IjI1OC4xNCIgcj0iMS4yOSIgb3BhY2l0eT0iMC44NiIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMC41MnM7IGFuaW1hdGlvbi1kZWxheTotOS4zNHM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI1MjQuNjkiIGN5PSIyMTMuNzUiIHI9IjEuNjQiIG9wYWNpdHk9IjAuNDIiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTEuNjNzOyBhbmltYXRpb24tZGVsYXk6LTMuODVzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNjguNjAiIGN5PSI4MS42MiIgcj0iMi40NSIgb3BhY2l0eT0iMC44OCIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMC42NXM7IGFuaW1hdGlvbi1kZWxheTotMTEuOTVzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iNTI5LjM3IiBjeT0iMzU0LjkyIiByPSIxLjU2IiBvcGFjaXR5PSIwLjMxIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjguODRzOyBhbmltYXRpb24tZGVsYXk6LTEyLjE3czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjUyNC4yOCIgY3k9IjM1MC44MiIgcj0iMS44NCIgb3BhY2l0eT0iMC45MSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMS41NHM7IGFuaW1hdGlvbi1kZWxheTotNy45M3M7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI0NDYuMTIiIGN5PSIxMTMuOTYiIHI9IjEuNDAiIG9wYWNpdHk9IjAuNzEiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ny4wNXM7IGFuaW1hdGlvbi1kZWxheTotMTAuNjNzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTQwLjA2IiBjeT0iMjI2LjI3IiByPSIxLjIxIiBvcGFjaXR5PSIwLjYyIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjM3czsgYW5pbWF0aW9uLWRlbGF5Oi05LjA1czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjMxNS4wMSIgY3k9IjQ4OC4zMiIgcj0iMS42NyIgb3BhY2l0eT0iMC42NyIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMS40MnM7IGFuaW1hdGlvbi1kZWxheTotNi45OHM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIyODIuNjkiIGN5PSIxMC4xMCIgcj0iMS43MCIgb3BhY2l0eT0iMC44NiIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo2LjI4czsgYW5pbWF0aW9uLWRlbGF5Oi0xMy45NHM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI5My4wNyIgY3k9IjI1NS42OSIgcj0iMi4xNiIgb3BhY2l0eT0iMC42NiIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo4LjkwczsgYW5pbWF0aW9uLWRlbGF5Oi05LjQ0czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjI5OS45NCIgY3k9IjQyMy41MSIgcj0iMS4xNyIgb3BhY2l0eT0iMC40OSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo4LjkyczsgYW5pbWF0aW9uLWRlbGF5Oi0xMC41MnM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI0MTcuMDIiIGN5PSIyNzQuMTciIHI9IjEuOTAiIG9wYWNpdHk9IjAuNjEiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTAuMzJzOyBhbmltYXRpb24tZGVsYXk6LTEuMjNzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzMwLjc3IiBjeT0iMjczLjAwIiByPSIxLjgyIiBvcGFjaXR5PSIwLjY3IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjkuODVzOyBhbmltYXRpb24tZGVsYXk6LTcuNjdzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMjU4LjE0IiBjeT0iNTA4LjQxIiByPSIyLjEyIiBvcGFjaXR5PSIwLjQ4IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjE0czsgYW5pbWF0aW9uLWRlbGF5Oi0wLjgxczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjMwMi4xNCIgY3k9IjUwOS4zNiIgcj0iMi4zNCIgb3BhY2l0eT0iMC42MSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1Ljk2czsgYW5pbWF0aW9uLWRlbGF5Oi0xMi4zMHM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIzOS4xNyIgY3k9IjEyOS45NCIgcj0iMS4xMiIgb3BhY2l0eT0iMC45MyIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo5LjY5czsgYW5pbWF0aW9uLWRlbGF5Oi0zLjAyczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjgzLjQwIiBjeT0iMzg2LjcwIiByPSIyLjA2IiBvcGFjaXR5PSIwLjk4IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjYuMDBzOyBhbmltYXRpb24tZGVsYXk6LTEuNjRzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTE4LjU4IiBjeT0iNTE0LjM1IiByPSIxLjY0IiBvcGFjaXR5PSIwLjg4IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjguNDFzOyBhbmltYXRpb24tZGVsYXk6LTAuMTRzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iODcuMTkiIGN5PSIyMzMuMDIiIHI9IjEuODIiIG9wYWNpdHk9IjAuNTIiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ny4zN3M7IGFuaW1hdGlvbi1kZWxheTotMTEuMjZzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzg5Ljk2IiBjeT0iMTAuNTIiIHI9IjEuODkiIG9wYWNpdHk9IjAuNTMiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246OC4wOHM7IGFuaW1hdGlvbi1kZWxheTotMTMuNzVzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzM2LjkyIiBjeT0iMjc2LjYyIiByPSIxLjEwIiBvcGFjaXR5PSIwLjk4IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjExLjkwczsgYW5pbWF0aW9uLWRlbGF5Oi0yLjk2czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjU2LjU4IiBjeT0iMTQzLjQwIiByPSIxLjA2IiBvcGFjaXR5PSIwLjM5IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjEwLjQ1czsgYW5pbWF0aW9uLWRlbGF5Oi0xMC4yMXM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIyMjguMDIiIGN5PSI0OTIuMTYiIHI9IjIuMzEiIG9wYWNpdHk9IjAuOTQiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ni44MXM7IGFuaW1hdGlvbi1kZWxheTotMTEuOTFzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzA4LjEyIiBjeT0iMzc4LjIzIiByPSIxLjE0IiBvcGFjaXR5PSIwLjYwIiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjUuNDBzOyBhbmltYXRpb24tZGVsYXk6LTQuMzdzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzkuMTAiIGN5PSI1MDYuNzEiIHI9IjIuMDIiIG9wYWNpdHk9IjAuOTAiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTAuNjFzOyBhbmltYXRpb24tZGVsYXk6LTEyLjgzczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjM1Ljk4IiBjeT0iNDY1LjkwIiByPSIxLjczIiBvcGFjaXR5PSIwLjk1IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjcuMzdzOyBhbmltYXRpb24tZGVsYXk6LTYuMjZzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTQ0LjY0IiBjeT0iNjkuNzgiIHI9IjEuODQiIG9wYWNpdHk9IjAuNDEiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ni42N3M7IGFuaW1hdGlvbi1kZWxheTotMTIuNDdzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMjcuMjEiIGN5PSIxMDguOTUiIHI9IjEuNTAiIG9wYWNpdHk9IjAuNTAiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246Ny4xNHM7IGFuaW1hdGlvbi1kZWxheTotMy4zN3M7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIyNzAuMDUiIGN5PSI5Ni4wNyIgcj0iMS41NiIgb3BhY2l0eT0iMC4zMSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1LjEzczsgYW5pbWF0aW9uLWRlbGF5Oi0xMC40OXM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIzOTUuODYiIGN5PSIyOTcuNTciIHI9IjEuMzAiIG9wYWNpdHk9IjAuMzciIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246OC4zMnM7IGFuaW1hdGlvbi1kZWxheTotMC45MnM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSI0NDIuMjIiIGN5PSIyMzMuMzgiIHI9IjEuNzkiIG9wYWNpdHk9IjAuNjUiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246MTAuODRzOyBhbmltYXRpb24tZGVsYXk6LTguNTBzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMzcxLjM4IiBjeT0iNTMwLjUyIiByPSIxLjU1IiBvcGFjaXR5PSIwLjc1IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjEwLjgzczsgYW5pbWF0aW9uLWRlbGF5Oi00LjExczsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjIxOC41NCIgY3k9IjE4Ny42OCIgcj0iMS4wOSIgb3BhY2l0eT0iMC44MiIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo1LjkxczsgYW5pbWF0aW9uLWRlbGF5Oi0xMy4wMXM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIxMzguMDIiIGN5PSI4OC4xNSIgcj0iMS4xNCIgb3BhY2l0eT0iMC43NyIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjoxMC44OXM7IGFuaW1hdGlvbi1kZWxheTotMS44MXM7IiAvPjxjaXJjbGUgY2xhc3M9InN0YXIiIGN4PSIxNTIuMjQiIGN5PSIxMzAuNzkiIHI9IjEuNDciIG9wYWNpdHk9IjAuNjEiIHN0eWxlPSJhbmltYXRpb24tZHVyYXRpb246OC4yMnM7IGFuaW1hdGlvbi1kZWxheTotMTEuNzlzOyIgLz48Y2lyY2xlIGNsYXNzPSJzdGFyIiBjeD0iMTQyLjE1IiBjeT0iNTE5LjM2IiByPSIyLjU2IiBvcGFjaXR5PSIwLjk4IiBzdHlsZT0iYW5pbWF0aW9uLWR1cmF0aW9uOjguODNzOyBhbmltYXRpb24tZGVsYXk6LTEwLjU4czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjE2Ny4xNiIgY3k9IjE5Mi41NiIgcj0iMS4wMCIgb3BhY2l0eT0iMC42NSIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo3LjY3czsgYW5pbWF0aW9uLWRlbGF5Oi03LjM1czsiIC8+PGNpcmNsZSBjbGFzcz0ic3RhciIgY3g9IjEwOC41MyIgY3k9IjI3Mi41NiIgcj0iMS4wMSIgb3BhY2l0eT0iMC41OCIgc3R5bGU9ImFuaW1hdGlvbi1kdXJhdGlvbjo2Ljg1czsgYW5pbWF0aW9uLWRlbGF5Oi0xMi43NHM7IiAvPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMwMDEwMjQiIG9wYWNpdHk9IjAuMTAiIC8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjcwIDI3MCkiPjx0ZXh0IHg9IjAiIHk9Ii02IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjMwIiBmb250LWZhbWlseT0iSW50ZXIsIE1vbnRzZXJyYXQsIFNGIFBybyBEaXNwbGF5LCBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIFNlZ29lIFVJLCBBcmlhbCIgZmlsbD0iI2Y3ZjJkZiIgbGV0dGVyLXNwYWNpbmc9IjAuMDZlbSIgZm9udC13ZWlnaHQ9IjUwMCIgZmlsdGVyPSJ1cmwoI3RleHRHbG93KSI+0JPQkNCg0JzQntCd0JjQry3QnNCQ0Jo8L3RleHQ+PHRleHQgeD0iMCIgeT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtZmFtaWx5PSJJbnRlciwgTW9udHNlcnJhdCwgU0YgUHJvIERpc3BsYXksIHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgU2Vnb2UgVUksIEFyaWFsIiBmaWxsPSIjZjdmMmRmIiBvcGFjaXR5PSIwLjg1IiBsZXR0ZXItc3BhY2luZz0iMC4wMmVtIiBmb250LXdlaWdodD0iNDAwIj7QodCw0LzQvtC/0L7Qt9C90LDQvdC40LU8L3RleHQ+PC9nPjwvc3ZnPg=="
              alt="Гармония-МАК — Самопознание"
              className="page-main-image__img"
            />}
            <MainMenuBottomAnimated />
          </div>
        )}
        <nav className="bottom-nav">
          <button type="button" className="bottom-nav-button bottom-nav-button--primary" onClick={onOpenDaily}>
            ВАША ЦИФРА ДНЯ
          </button>
          <button
            type="button"
            className="bottom-nav-button bottom-nav-button--menu bottom-nav-button--active"
            onClick={() => {
              if (learningView !== "menu") resetLearning();
            }}
          >
            Меню
          </button>
          <button type="button" className="bottom-nav-button bottom-nav-button--primary" onClick={onOpenCabinet}>
            Личный кабинет
          </button>
        </nav>
      </div>
    </main>
  );
};

export default MainMenuScreen;
