import { useState } from "react";
import { resolveCardDayMessage, getTodayKey } from "../../shared/utils";
import { apiCall } from "../../shared/api";

type CardDayData = {
  title: string;
  description: string;
  imagePath?: string;
  dayMessage?: string | null;
};

type Props = {
  onDialogWithAi: (card: CardDayData) => void;
  onBack: () => void;
  onMainMenu: () => void;
};

const CardDayView: React.FC<Props> = ({ onDialogWithAi, onBack, onMainMenu }) => {
  const [cardDay, setCardDay] = useState<CardDayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenToday, setChosenToday] = useState(() => {
    try {
      return window.localStorage.getItem("card_day_chosen_date") === getTodayKey();
    } catch {
      return false;
    }
  });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const handleSelectCard = async (idx: number) => {
    if (chosenToday) {
      setHint("Сегодня вы уже выбрали свою карту дня. Остальные карты откроются завтра.");
      return;
    }
    setSelectedIndex(idx);
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await apiCall("/api/card-day", {});
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Не удалось получить карту дня. Попробуйте позже.");
        return;
      }
      const data = (await res.json()) as {
        title: string;
        description: string;
        image_path?: string;
        day_message?: string;
        dayMessage?: string;
      };
      setCardDay({
        title: data.title ?? "",
        description: data.description ?? "",
        imagePath: data.image_path,
        dayMessage: resolveCardDayMessage(data),
      });
      setChosenToday(true);
      try {
        window.localStorage.setItem("card_day_chosen_date", getTodayKey());
      } catch {
        // ignore
      }
    } catch {
      setError("Произошла ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (cardDay) {
      setCardDay(null);
      setSelectedIndex(null);
      setHint(null);
      setError(null);
      setLoading(false);
      setChosenToday(false);
      try {
        window.localStorage.removeItem("card_day_chosen_date");
      } catch {
        // ignore
      }
    } else {
      onBack();
    }
  };

  // Подгрузка уже выбранной карты при монтировании
  useState(() => {
    if (!chosenToday) return;
    setLoading(true);
    (async () => {
      try {
        const res = await apiCall("/api/card-day", {});
        if (!res.ok) {
          const msg = await res.text();
          setError(msg || "Не удалось получить карту дня. Попробуйте позже.");
          return;
        }
        const data = (await res.json()) as {
          title: string;
          description: string;
          image_path?: string;
          day_message?: string;
          dayMessage?: string;
        };
        setCardDay({
          title: data.title ?? "",
          description: data.description ?? "",
          imagePath: data.image_path,
          dayMessage: resolveCardDayMessage(data),
        });
      } catch {
        setError("Произошла ошибка сети. Попробуйте ещё раз.");
      } finally {
        setLoading(false);
      }
    })();
  });

  return (
    <>
      <p className="onboarding-subtitle">
        Здесь вы можете получить свою «карту дня» — короткое послание и подсказку на сегодня.
      </p>
      <div className="technique-text technique-text--card-day">
        {loading && <p className="technique-body">Подбираем карту дня…</p>}
        {error && <p className="dialog-error">{error}</p>}
        {!chosenToday && !cardDay && !loading && !error && (
          <>
            <p className="technique-body">Выберите одну из 9 карт ниже. Остальные останутся закрытыми.</p>
            <div className="card-day-grid">
              {Array.from({ length: 9 }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`card-day-card ${selectedIndex === idx ? "card-day-card--selected" : "card-day-card--closed"}`}
                  onClick={() => void handleSelectCard(idx)}
                >
                  <span className="card-day-card-label">Карта {idx + 1}</span>
                </button>
              ))}
            </div>
            {hint && <p className="technique-body">{hint}</p>}
          </>
        )}
        {cardDay && (
          <>
            <p className="technique-body">
              Ваша карта дня на сегодня. Следующая карта станет доступна после 00:00 по московскому времени.
            </p>
            {cardDay.title && <h2 className="technique-title">{cardDay.title}</h2>}
            {cardDay.imagePath && (
              <div className="card-day-image-wrapper">
                <img src={cardDay.imagePath} alt={cardDay.title || "Карта дня"} className="card-day-image" />
              </div>
            )}
            <h3 className="card-day-message-title">Послание на день</h3>
            <p className="technique-body card-day-daily-message">
              {(cardDay.dayMessage ?? "").trim()
                ? (cardDay.dayMessage ?? "").trim()
                : resolveCardDayMessage({ title: cardDay.title, description: cardDay.description })}
            </p>
            <p className="technique-body card-day-reflection-hint">
              {`Можно отметить для себя:\n• какие детали привлекают внимание;\n• какие чувства и мысли появляются;\n• с какими ситуациями в вашей жизни это перекликается.`}
            </p>
            <button type="button" className="spin-button" onClick={() => onDialogWithAi(cardDay)}>
              Разобрать карту с ИИ психологом
            </button>
          </>
        )}
      </div>
      <button type="button" className="secondary-button" onClick={handleBack}>
        Назад
      </button>
      <button type="button" className="secondary-button" onClick={onMainMenu}>
        Главное меню
      </button>
    </>
  );
};

export default CardDayView;
