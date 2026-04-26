import { useEffect, useState } from "react";
import { STORAGE_KEY_BIRTH_CODE_DRAFT } from "../../shared/constants";
import {
  sanitizeFullNameInput,
  formatBirthDateInput,
  validateFullName,
  validateBirthDate,
  buildBirthCodeReport,
} from "../../shared/utils";
import type { BirthCodeAnalysisContext, BirthCodeReport } from "../../shared/types";

type Props = {
  initialContext: BirthCodeAnalysisContext | null;
  onContextCreated: (ctx: BirthCodeAnalysisContext) => void;
  onDiscussWithAi: (reportText: string) => void;
  onBack: () => void;
  onMainMenu: () => void;
};

const BirthCodeView: React.FC<Props> = ({ initialContext, onContextCreated, onDiscussWithAi, onBack, onMainMenu }) => {
  const [phase, setPhase] = useState<"intro" | "loading" | "report">(initialContext ? "report" : "intro");
  const [form, setForm] = useState({ fullName: "", birthDate: "" });
  const [errors, setErrors] = useState<Partial<Record<"fullName" | "birthDate", string>>>({});
  const [report, setReport] = useState<BirthCodeReport | null>(
    initialContext ? buildBirthCodeReport(initialContext.birthDate) : null,
  );
  const [context, setContext] = useState<BirthCodeAnalysisContext | null>(initialContext);

  useEffect(() => {
    if (phase !== "intro") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_BIRTH_CODE_DRAFT);
      if (raw) {
        const d = JSON.parse(raw) as { fullName?: string; birthDate?: string };
        setForm({
          fullName: typeof d.fullName === "string" ? d.fullName : "",
          birthDate: typeof d.birthDate === "string" ? d.birthDate : "",
        });
      }
    } catch {
      // ignore
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "intro") return;
    try {
      sessionStorage.setItem(STORAGE_KEY_BIRTH_CODE_DRAFT, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form, phase]);

  const handleFieldChange = (field: "fullName" | "birthDate", value: string) => {
    const next = field === "fullName" ? sanitizeFullNameInput(value) : formatBirthDateInput(value);
    setForm((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<"fullName" | "birthDate", string>> = {};
    const fn = validateFullName(form.fullName);
    const bd = validateBirthDate(form.birthDate);
    if (fn.error) errs.fullName = fn.error;
    if (bd.error) errs.birthDate = bd.error;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const fullName = (fn.normalized ?? form.fullName.trim()).replace(/\s+/g, " ");
    const birthDate = bd.normalized ?? form.birthDate.trim();
    const ctx = { fullName, birthDate };
    setContext(ctx);
    onContextCreated(ctx);
    setErrors({});
    setPhase("loading");
    setReport(null);
    window.setTimeout(() => {
      setReport(buildBirthCodeReport(birthDate));
      setPhase("report");
    }, 2200);
  };

  const handleDiscuss = () => {
    if (!report) return;
    const ctxLine = context
      ? `Данные для этого разбора (не из профиля кабинета): ${context.fullName}, дата рождения ${context.birthDate}.\n\n`
      : "";
    const reportText = `${ctxLine}Хочу обсудить мой психологический код по дате рождения.\n\nТип личности: ${report.personalityType}\nКлючевая энергия: ${report.keyEnergy}\n\nКак я принимаю решения: ${report.decisionPattern}\n\nСильные стороны:\n- ${report.strengths.join("\n- ")}\n\nОграничения:\n- ${report.conflicts.join("\n- ")}\n\nФокус сейчас: ${report.focusNow}`;
    onDiscussWithAi(reportText);
  };

  const handleBack = () => {
    if (phase === "report") {
      setReport(null);
      setContext(null);
      setPhase("intro");
    } else if (phase === "loading") {
      setPhase("intro");
    } else {
      onBack();
    }
  };

  if (phase === "loading") {
    return (
      <>
        <h2 className="technique-title">Я анализирую вашу дату…</h2>
        <div className="technique-text">
          <p className="technique-body">
            {`Смотрю на ключевые числа,\nповеденческие паттерны\nи текущие внутренние процессы.\n\nЭто займёт несколько секунд.`}
          </p>
        </div>
      </>
    );
  }

  if (phase === "report" && report) {
    return (
      <>
        <h2 className="technique-title">Ваш психологический код по дате рождения</h2>
        <div className="technique-text technique-text--birth-code">
          <h3 className="birth-code-section-title">🔹 Ваш базовый профиль</h3>
          <p className="technique-body"><strong>Тип личности:</strong> {report.personalityType}</p>
          <p className="technique-body"><strong>Ключевая энергия:</strong> {report.keyEnergy}</p>
          <h3 className="birth-code-section-title">🔹 Как вы принимаете решения</h3>
          <p className="technique-body">{report.decisionPattern}</p>
          <h3 className="birth-code-section-title">🔹 Ваши сильные стороны</h3>
          <ul className="birth-code-list">{report.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
          <h3 className="birth-code-section-title">🔹 Внутренние конфликты / ограничения</h3>
          <ul className="birth-code-list">{report.conflicts.map((item, i) => <li key={i}>{item}</li>)}</ul>
          <h3 className="birth-code-section-title">🔹 На что вам сейчас обратить внимание</h3>
          <p className="technique-body">{report.focusNow}</p>
        </div>
        <button type="button" className="spin-button" onClick={handleDiscuss}>
          🤖 Обсудить результат с ИИ психологом
        </button>
        <button type="button" className="secondary-button" onClick={handleBack}>Назад</button>
        <button type="button" className="secondary-button" onClick={onMainMenu}>Главное меню</button>
      </>
    );
  }

  return (
    <>
      <h2 className="technique-title">Разбор по дате рождения</h2>
      <div className="technique-text">
        <p className="technique-body">
          {`Сначала коротко о смысле разбора.\n\nДата рождения задаёт «каркас» личности: сильные стороны, внутренние конфликты, привычные паттерны и точки роста.\n\nНиже введите данные только для этого расчёта — мы не привязываем их к личному кабинету как к профилю.`}
        </p>
        <p className="technique-body" style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
          Шаг 1. Данные для расчёта
        </p>
      </div>
      <form className="onboarding-form" onSubmit={handleSubmit}>
        <label className="onboarding-field">
          <span className="onboarding-label">ФИО</span>
          <input
            type="text"
            className={`onboarding-input ${errors.fullName ? "has-error" : ""}`}
            placeholder="Как к вам обращаться в тексте разбора"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => handleFieldChange("fullName", e.target.value)}
          />
          {errors.fullName && <span className="onboarding-error">{errors.fullName}</span>}
        </label>
        <label className="onboarding-field">
          <span className="onboarding-label">Дата рождения</span>
          <input
            type="text"
            inputMode="numeric"
            className={`onboarding-input ${errors.birthDate ? "has-error" : ""}`}
            placeholder="ДД.ММ.ГГГГ"
            autoComplete="bday"
            value={form.birthDate}
            onChange={(e) => handleFieldChange("birthDate", e.target.value)}
          />
          {errors.birthDate && <span className="onboarding-error">{errors.birthDate}</span>}
        </label>
        <button type="submit" className="spin-button">Далее: получить разбор</button>
      </form>
      <button type="button" className="secondary-button" onClick={onBack}>Назад</button>
      <button type="button" className="secondary-button" onClick={onMainMenu}>Главное меню</button>
    </>
  );
};

export default BirthCodeView;
