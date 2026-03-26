import { useCallback, useState } from "react";

type Step = {
  title: string;
  text?: string;
  items?: string[];
};

const STEPS: Step[] = [
  {
    title: "Добро пожаловать",
    text: "«Гармония-Мак» — пространство для самопознания: спокойные практики, карты, цифры дня и опора на себя. Здесь можно мягко прислушиваться к себе и своему  « Я »  без спешки и достичь результата.",
  },
  {
    title: "Меню и поддержка",
    text: "Этот бот умеет:",
    items: [
      "Ваш персональный ИИ-психолог-коуч",
      "Работа с Mac картами",
      "Техники и практики",
      "Разборы и расклады",
      "Карта дня",
      "Расшифровка вашей карты по фото",
      "Ваш личный кабинет, где вы найдете все ваши разборы",
    ],
  },
  {
    title: "Цифра дня",
    text: "В приложении есть компас: с помощью вашей цифры дня он настраивает на положительный лад и дает вам подсказку на день. Нажмите «Крутить», чтобы получить свой ориентир.",
  },
  {
    title: "С чего начать",
    items: [
      "Настройтесь на работу с самопознанием.",
      "При желании пройдите короткий опрос в меню — так ваш ИИ-психолог лучше поймет вас и даст более точный ответ и подсказку в вашем вопросе.",
      "Внизу всегда есть переход между «Цифрой дня», «Меню» и кабинетом.",
    ],
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
        {step.text ? <p className="onboarding-flow__text">{step.text}</p> : null}
        {step.items?.length ? (
          <ul className="onboarding-flow__list">
            {step.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
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
