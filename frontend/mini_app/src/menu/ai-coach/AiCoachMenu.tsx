import type React from "react";

type Props = {
  onOpenTechniques: () => void;
  onOpenCardDecode: () => void;
  onOpenCardDay: () => void;
  onOpenAffirmation: () => void;
  onOpenHoroscope: () => void;
  onOpenBirthCode: () => void;
  onBack: () => void;
};

const AiCoachMenu: React.FC<Props> = ({
  onOpenTechniques,
  onOpenCardDecode,
  onOpenCardDay,
  onOpenAffirmation,
  onOpenHoroscope,
  onOpenBirthCode,
  onBack,
}) => (
  <>
    <p className="onboarding-subtitle">Выберите формат работы, который вам нужен сейчас.</p>
    <div className="main-menu-list">
      <button type="button" className="main-menu-item" onClick={onOpenTechniques}>
        Техники
      </button>
      <button type="button" className="main-menu-item" onClick={onOpenCardDecode}>
        Расшифровка карты
      </button>
      <button type="button" className="main-menu-item" onClick={onOpenCardDay}>
        Карта дня
      </button>
      <button type="button" className="main-menu-item" onClick={onOpenAffirmation}>
        Аффирмация дня
      </button>
      <button type="button" className="main-menu-item" onClick={onOpenHoroscope}>
        Гороскоп
      </button>
      <button type="button" className="main-menu-item" onClick={onOpenBirthCode}>
        Ваш психологический код по дате рождения
      </button>
    </div>
    <button type="button" className="secondary-button" onClick={onBack}>
      Назад
    </button>
  </>
);

export default AiCoachMenu;
