import type React from "react";

type Props = {
  onStartDialog: () => void;
  onBack: () => void;
  onMainMenu: () => void;
};

const CardDecodeView: React.FC<Props> = ({ onStartDialog, onBack, onMainMenu }) => (
  <>
    <p className="onboarding-subtitle">
      Этот режим помогает разбирать карту, которую вы видите перед собой.
    </p>
    <div className="technique-text">
      <h2 className="technique-title">Как работать с расшифровкой карты</h2>
      <p className="technique-body">
        {`1. Возьмите карту (физическую или в телефоне) и несколько секунд просто посмотрите на неё.\n\n2. Обратите внимание на детали: цвета, образы, персонажей, то, что больше всего притягивает взгляд.\n\n3. Заметьте свои чувства и мысли: какие эмоции вызывает карта, с чем ассоциируется, какие воспоминания всплывают.\n\n4. Сформулируйте запрос: о чём именно вы хотите спросить карту? О ситуации, решении, отношении к себе, следующем шаге?`}
      </p>
      <p className="technique-body">
        {`5. Когда будете готовы — нажмите кнопку ниже и опишите карту и ситуацию в диалоге с ИИ‑Психологом. Он поможет вам увидеть связи между образом карты и вашей жизнью, задать нужные вопросы и нащупать решения.`}
      </p>
    </div>
    <button type="button" className="spin-button" onClick={onStartDialog}>
      Перейти в диалог для расшифровки карты
    </button>
    <button type="button" className="secondary-button" onClick={onBack}>
      Назад
    </button>
    <button type="button" className="secondary-button" onClick={onMainMenu}>
      Главное меню
    </button>
  </>
);

export default CardDecodeView;
