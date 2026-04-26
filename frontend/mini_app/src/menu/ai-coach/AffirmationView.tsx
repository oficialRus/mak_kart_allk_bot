import { useEffect, useState } from "react";
import type React from "react";
import { getTodayMoscowRuDate, splitDailyAffirmationMessage } from "../../shared/utils";
import { apiCall } from "../../shared/api";

type Props = {
  onBack: () => void;
};

const AffirmationView: React.FC<Props> = ({ onBack }) => {
  const [message, setMessage] = useState("✨Аффирмация дня✨\n\n«Генерируем аффирмацию…»");

  const buildLocalFallback = () =>
    `✨Аффирмация дня - ${getTodayMoscowRuDate()}✨\n\n` +
    "«Я встречаю этот день в состоянии внутреннего спокойствия и ясности. " +
    "Я чувствую опору в себе, с благодарностью принимаю каждый шаг и мягко двигаюсь вперёд. " +
    "Я открыт(а) возможностям этого дня и выбираю действовать бережно, с теплом к себе.»";

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await apiCall("/api/daily-affirmation", {}, { signal: controller.signal });
        if (!res.ok) {
          setMessage(buildLocalFallback());
          return;
        }

        const data = (await res.json()) as { affirmation?: string };
        const next = (data.affirmation ?? "").trim();
        if (next) {
          setMessage(next);
        } else {
          setMessage(buildLocalFallback());
        }
      } catch {
        setMessage(buildLocalFallback());
      }
    })();

    return () => controller.abort();
  }, []);

  const { title, body } = splitDailyAffirmationMessage(message);

  return (
    <>
      <h2 className="technique-title">Аффирмация дня</h2>
      <div className="daily-affirmation-text">
        <div className="daily-affirmation-text__title">{title}</div>
        <div className="daily-affirmation-text__body">{body}</div>
      </div>
      <button type="button" className="secondary-button" onClick={onBack}>
        Назад
      </button>
    </>
  );
};

export default AffirmationView;
