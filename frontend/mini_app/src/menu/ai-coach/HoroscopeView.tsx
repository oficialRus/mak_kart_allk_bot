import type React from "react";

type Props = {
  horoscopeBlocks: { name: string; headline: string; text: string }[];
  onBack: () => void;
};

const HoroscopeView: React.FC<Props> = ({ horoscopeBlocks, onBack }) => (
  <>
    <h2 className="technique-title">Гороскоп на сегодня</h2>
    <p className="onboarding-subtitle horoscope-subtitle">
      Тексты обновляются каждый календарный день по дате на вашем устройстве.
    </p>
    <div className="horoscope-list">
      {horoscopeBlocks.map((block) => (
        <article key={block.name} className="horoscope-card">
          <h3 className="horoscope-card__headline">{block.headline}</h3>
          <p className="horoscope-card__text">{block.text}</p>
        </article>
      ))}
    </div>
    <button type="button" className="secondary-button" onClick={onBack}>
      Назад
    </button>
  </>
);

export default HoroscopeView;
