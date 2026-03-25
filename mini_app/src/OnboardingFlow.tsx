import { useCallback, useState } from "react";

type Step = {
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    title: "Добро пожаловать",
    text: "«Гармония-Мак» — пространство для самопознания: спокойные практики, карты, цифры дня и опора на себя. Здесь можно мягко прислушиваться к себе без спешки.",
  },
  {
    title: "Цифра дня",
    text: "Каждый день доступен компас с числом и посланием — как мягкое направление на сутки. Нажмите «Крутить», чтобы получить свой ориентир.",
  },
  {
    title: "Меню и поддержка",
    text: "В меню — техники, работа с картами и диалог с ИИ‑психологом. В личном кабинете — сохранённые разборы. Имя и дата рождения для кодов по дате вы вводите только в этом разборе.",
  },
  {
    title: "С чего начать",
    text: "Нажмите «Начать» на первом экране, чтобы войти. При желании пройдите короткий опрос обучения в меню — так мы лучше подстроим подсказки. Внизу всегда есть переход между «Цифрой дня», «Меню» и кабинетом.",
  },
];

type Props = {
  onComplete: () => void;
};

export default function OnboardingFlow({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const onSkip = useCallback(() => {
    finish();
  }, [finish]);

  const onNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [isLast, finish]);

  return (
    <div className="onboarding-flow" role="dialog" aria-modal="true" aria-labelledby="onboarding-flow-title">
      <div className="onboarding-flow__top">
        <button type="button" className="onboarding-flow__skip" onClick={onSkip}>
          Пропустить
        </button>
      </div>

      <div className="onboarding-flow__body">
        <h1 id="onboarding-flow-title" className="onboarding-flow__title">
          {step.title}
        </h1>
        <p className="onboarding-flow__text">{step.text}</p>
      </div>

      <div className="onboarding-flow__dots" aria-hidden>
        {STEPS.map((_, i) => (
          <span key={i} className={`onboarding-flow__dot ${i === index ? "onboarding-flow__dot--active" : ""}`} />
        ))}
      </div>

      <div className="onboarding-flow__actions">
        <button type="button" className="spin-button onboarding-flow__next" onClick={onNext}>
          {isLast ? "Начать" : "Далее"}
        </button>
      </div>
    </div>
  );
}
