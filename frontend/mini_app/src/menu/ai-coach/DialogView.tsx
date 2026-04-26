import { Fragment, useEffect, useRef, useState } from "react";
import { TECHNIQUES, TECHNIQUE_DONE_TOKEN } from "../../shared/constants";
import type { DialogOrigin } from "../../shared/types";
import { apiCall } from "../../shared/api";

type DialogMessage = { from: "user" | "ai"; text: string };

export type DialogEntry = {
  origin: DialogOrigin;
  initialMessages: DialogMessage[];
  fromReview: boolean;
  allowImage: boolean;
  techniqueId: number | null;
  autoSend?: { userMessage: string; imagePath?: string };
};

type Props = {
  entry: DialogEntry;
  onBack: (origin: DialogOrigin, fromReview: boolean) => void;
  onMainMenu: () => void;
  onChooseAnotherTechnique: () => void;
  onInputFocusChange: (focused: boolean) => void;
};

async function callAiDialog(message: string, history: DialogMessage[], imageDataUrl: string | null) {
  const res = await apiCall("/api/ai-dialog", {
    message,
    history: history.map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
    imageDataUrl,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Не удалось получить ответ.");
  }
  const data = (await res.json()) as { reply: string };
  return data.reply ?? "";
}

function buildPrompt(scenario: "analyze" | "run" | "ask", techniqueTitle: string, techniqueText: string, userText: string): string {
  if (scenario === "analyze") {
    return `Ты ИИ‑Психолог.\nСценарий: "Разобрать технику под вашу ситуацию" (помочь понять, как техника работает именно для пользователя, ПРЕЖДЕ чем проходить её).\n\nТехника: ${techniqueTitle}\nТекст техники (используй как справку, не цитируй полностью):\n${techniqueText}\n\nСитуация пользователя:\n${userText}\n\nОтветь структурно (коротко и по делу):\n1) Объясни смысл техники простым языком: что она делает и зачем.\n2) Покажи связь с состоянием пользователя: что именно в ситуации откликается/вызывает напряжение и как техника это адресует.\n3) Расшифруй каждый шаг: ЗАЧЕМ он, что даёт пользователю именно в этой ситуации.\n4) Задай 1–2 уточняющих вопроса (выбери подходящие):\n   - "В какой момент вы чаще всего сталкиваетесь с этим состоянием?"\n   - "Что именно внутри вас откликается на эту технику?"\n5) Подведи итог: "В вашем случае эта техника поможет…" (2–3 предложения).\nВ конце просто одной строкой: "👉 Пройти технику сейчас" (без больших списков).`;
  }
  if (scenario === "run") {
    return `Ты — ИИ‑психолог‑коуч. Твоя задача — вести пользователя через технику.\n\nТехника (контекст):\n${techniqueTitle}\n${techniqueText}\n\nСейчас пользователь ответил:\n${userText}\n\nПравила:\n1) НЕ выдавай всю технику сразу.\n2) Выдавай только ОДИН следующий шаг + один конкретный вопрос.\n3) Шаг адаптируй под то, что пользователь написал, используя историю.\n4) После выполнения шага пользователь должен ответить.\n5) Говори мягко и поддерживающе.\n\nЕсли техника подошла к завершению, то в твоём ответе должна быть финальная поддержка + итог (коротко) + последний вопрос: "Что вы сейчас чувствуете? Что изменилось внутри?". В таком случае ДОПОЛНИТЕЛЬНО добавь в конец точный маркер: ${TECHNIQUE_DONE_TOKEN}`;
  }
  return `Ты — ИИ‑психолог‑коуч.\n\nСценарий: ответить на вопрос пользователя про эту технику или его состояние.\n\nТехника (контекст):\n${techniqueTitle}\n${techniqueText}\n\nВопрос/сообщение пользователя:\n${userText}\n\nТвоя задача:\n1) Отвечай мягко и поддерживающе.\n2) Объясни просто и по-человечески.\n3) Упрости: убери лишнее, оставь суть.\n4) Направь: дай 1–3 практичных опоры/действия или мини-шаг.\n5) Если в вопросе есть неопределённость — задай ОДИН уточняющий вопрос.\n\nВ конце (очень коротко) предложи следующий шаг из вариантов:\n- "Разобрать технику глубже"\n- "Пройти технику"\n- "В главное меню" (если уместно).`;
}

function buildRunStartPrompt(title: string, text: string): string {
  return `Ты — ИИ‑психолог‑коуч. Твоя задача — провести пользователя через психологическую технику пошагово (шаг → вопрос → ответ → следующий шаг).\n\nТехника: ${title}\nТекст техники: ${text}\n\nПравила:\n1) НЕ выдавай всю технику сразу.\n2) В каждом сообщении давай только ОДИН следующий шаг + один конкретный вопрос.\n3) Адаптируй формулировку шага под то, что пользователь ответит (используй историю).\n4) Говори мягко и поддерживающе, помогай осознавать чувства/мысли.\n5) НЕ делай огромных текстов.\n6) В конце, когда техника будет полностью завершена, добавь маркер в последней строке: ${TECHNIQUE_DONE_TOKEN}\n\nНачни сейчас:\nКороткое введение (1–2 предложения).\nПотом: "Начнём." + (переформулированный) Шаг 1.\nЗатем один вопрос пользователю:\nЧто вы сейчас видите/чувствуете/выбираете?`;
}

const renderDialogText = (text: string) => {
  const lines = text.split(/\n/);
  return lines.map((line, idx) => {
    const tokens = line.split(/(Шаг\s*\d+)/g);
    return (
      <Fragment key={`${idx}-${line}`}>
        {tokens.map((t, i) =>
          /^Шаг\s*\d+$/u.test(t.trim()) ? (
            <span key={i} className="dialog-technique-step">{t}</span>
          ) : (
            <Fragment key={i}>{t}</Fragment>
          ),
        )}
        {idx < lines.length - 1 ? <br /> : null}
      </Fragment>
    );
  });
};

const DialogView: React.FC<Props> = ({ entry, onBack, onMainMenu, onChooseAnotherTechnique, onInputFocusChange }) => {
  const [messages, setMessages] = useState<DialogMessage[]>(entry.initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [allowImage, setAllowImage] = useState(entry.allowImage);
  const [showTechniqueMenu, setShowTechniqueMenu] = useState(entry.origin === "technique");
  const [scenario, setScenario] = useState<"analyze" | "run" | "ask" | null>(null);
  const [showProceedNow, setShowProceedNow] = useState(false);
  const [isRunFinished, setIsRunFinished] = useState(false);
  const [showAskNext, setShowAskNext] = useState(false);
  const [clearOnFocus, setClearOnFocus] = useState(false);
  const [fromReview] = useState(entry.fromReview);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const technique = entry.techniqueId != null ? TECHNIQUES.find((t) => t.id === entry.techniqueId) ?? null : null;

  useEffect(() => {
    if (messages.length === 0) return;
    const el = historyRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const lastIdx = messages.length - 1;
      const last = messages[lastIdx];
      if (last && last.from === "ai") {
        const lastEl = el.querySelector(`[data-msg-index="${lastIdx}"]`) as HTMLElement | null;
        if (lastEl) el.scrollTo({ top: lastEl.offsetTop, behavior: "smooth" });
        else el.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }, [messages]);

  useEffect(() => {
    if (!entry.autoSend) return;
    setLoading(true);
    const { userMessage, imagePath } = entry.autoSend;
    (async () => {
      let imgData: string | null = null;
      try {
        if (imagePath) {
          if (imagePath.startsWith("data:")) {
            imgData = imagePath;
          } else {
            const resp = await fetch(new URL(imagePath, window.location.href).toString());
            if (resp.ok) {
              const blob = await resp.blob();
              imgData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
                reader.onerror = () => reject();
                reader.readAsDataURL(blob);
              });
            }
          }
        }
      } catch { imgData = null; }
      try {
        const reply = await callAiDialog(userMessage, [], imgData);
        if (reply.trim()) setMessages((prev) => [...prev, { from: "ai", text: reply.trim() }]);
      } catch { setError("Произошла ошибка сети. Попробуйте ещё раз."); }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processReply = (rawReply: string) => {
    const cleaned = rawReply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
    setMessages((prev) => [...prev, { from: "ai", text: cleaned }]);
    if (scenario === "analyze") setShowProceedNow(true);
    if (scenario === "ask") setShowAskNext(true);
    if (scenario === "run" && rawReply.includes(TECHNIQUE_DONE_TOKEN)) setIsRunFinished(true);
  };

  const startTechniqueRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const reply = await callAiDialog(buildRunStartPrompt(technique?.title ?? "", technique?.text ?? ""), [], null);
      const cleaned = reply.replace(TECHNIQUE_DONE_TOKEN, "").trim();
      setMessages([{ from: "ai", text: cleaned }]);
      if (reply.includes(TECHNIQUE_DONE_TOKEN)) setIsRunFinished(true);
    } catch { setError("Произошла ошибка сети. Попробуйте ещё раз."); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);
    let requestMessage = text;
    if (scenario && technique) {
      requestMessage = buildPrompt(scenario, technique.title, technique.text, text);
    }
    const historyForRequest = [...messages, { from: "user" as const, text }];
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");
    try {
      const reply = await callAiDialog(requestMessage, historyForRequest, imageDataUrl);
      processReply(reply);
    } catch { setError("Произошла ошибка сети. Попробуйте ещё раз."); }
    finally { setLoading(false); setImageDataUrl(null); }
  };

  const handleProceedNow = async () => {
    const uiText = "Пройти технику сейчас";
    setShowProceedNow(false);
    setScenario("run");
    setAllowImage(false);
    setInput("");
    setError(null);
    setLoading(true);
    setIsRunFinished(false);
    const hist = [...messages, { from: "user" as const, text: uiText }];
    setMessages((prev) => [...prev, { from: "user", text: uiText }]);
    const prompt = `Ты — ИИ‑психолог‑коуч. Веди пользователя через технику пошагово.\n\nТехника (контекст): ${technique?.title ?? ""}\n${technique?.text ?? ""}\n\nИстория пользователя и твои предыдущие ответы уже есть.\n\nВ ответе сейчас дай первый следующий шаг (ОДИН шаг) и конкретный вопрос, на который пользователь должен ответить.\n\nПравила:\n1) НЕ выдавай всю технику.\n2) Шаг -> вопрос -> жди ответ.\n3) Адаптируй под ответ пользователя.\n\nЕсли техника подошла к завершению — добавь в конец маркер: ${TECHNIQUE_DONE_TOKEN}\n\nВеди мягко и поддерживающе.`;
    try {
      const reply = await callAiDialog(prompt, hist, null);
      processReply(reply);
    } catch { setError("Произошла ошибка сети. Попробуйте ещё раз."); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (messages.length) {
      try {
        await apiCall("/api/dialog-save", { mode: "dialog", title: "", messages: messages.map((m) => ({ from: m.from, text: m.text })) });
      } catch { /* ignore */ }
    }
    onBack(entry.origin, fromReview);
  };

  const resetToScenario = (sc: "analyze" | "run" | "ask") => {
    setShowAskNext(false);
    setIsRunFinished(false);
    setShowTechniqueMenu(false);
    setShowProceedNow(false);
    setScenario(sc);
    setMessages([]);
    setError(null);
    setLoading(false);
    setImageDataUrl(null);
    setAllowImage(sc === "ask");
    if (sc === "analyze") {
      setInput("Давайте разберём эту технику под вашу ситуацию. Что сейчас у вас откликается или вызывает напряжение?");
      setClearOnFocus(true);
    } else if (sc === "ask") {
      setInput("Задайте любой вопрос по этой технике или вашему состоянию — я помогу разобраться.");
      setClearOnFocus(true);
    } else {
      setInput("");
      void startTechniqueRun();
    }
  };

  const handleBackInternal = () => {
    if (entry.origin === "technique" && !showTechniqueMenu && scenario != null) {
      setShowTechniqueMenu(true);
      setShowAskNext(false);
      setShowProceedNow(false);
      setIsRunFinished(false);
      setScenario(null);
      setLoading(false);
      setError(null);
      setImageDataUrl(null);
      setAllowImage(false);
      setMessages([]);
      setInput("");
      setClearOnFocus(false);
      return;
    }
    onBack(entry.origin, fromReview);
  };

  if (showTechniqueMenu) {
    return (
      <>
        <p className="onboarding-subtitle">что ты хочешь сделать?</p>
        <div className="main-menu-list" style={{ marginTop: "0.85rem" }}>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("analyze")}>разобрать технику</button>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("run")}>пройти технику</button>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("ask")}>задать вопрос</button>
        </div>
        <button type="button" className="secondary-button" onClick={handleBackInternal}>Назад</button>
        <button type="button" className="secondary-button" onClick={onMainMenu}>Главное меню</button>
      </>
    );
  }

  const placeholder = scenario === "analyze" ? "Что сейчас у вас откликается или вызывает напряжение?"
    : scenario === "run" ? "Что получилось после выполнения Шага 1?"
    : scenario === "ask" ? "Ваш вопрос (что именно хотите понять/прояснить)?"
    : "Напишите свой вопрос или опишите ситуацию…";

  const subtitle = scenario === "analyze" ? "Давайте разберём эту технику под вашу ситуацию — что сейчас у вас откликается или вызывает напряжение?"
    : scenario === "run" ? "Сейчас проведём технику. Напишите результат выполнения Шага 1 или ваш ответ."
    : scenario === "ask" ? "Сформулируйте ваш вопрос по выбранной технике — и мы разберём его."
    : "Напишите, о чём хотите поговорить, и ИИ‑Психолог ответит вам в этом окне.";

  const showInput = !((isRunFinished && scenario === "run") || (showAskNext && scenario === "ask"));

  return (
    <>
      <p className="onboarding-subtitle">{subtitle}</p>
      {allowImage && <p className="onboarding-subtitle">Можно прикрепить фото для разбора.</p>}
      {(messages.length > 0 || loading) && (
        <div className="dialog-history" ref={historyRef}>
          {messages.map((m, idx) => (
            <div key={idx} className={m.from === "user" ? "dialog-bubble dialog-bubble-user" : "dialog-bubble dialog-bubble-ai"} data-msg-index={idx} data-msg-from={m.from}>
              {renderDialogText(m.text)}
            </div>
          ))}
          {loading && <div className="dialog-bubble dialog-bubble-ai">Психолог набирает ответ…</div>}
        </div>
      )}
      {error && <p className="dialog-error">{error}</p>}
      {showProceedNow && scenario === "analyze" && (
        <button type="button" className="secondary-button" disabled={loading} onClick={() => void handleProceedNow()}>👉 Пройти технику сейчас</button>
      )}
      <form className="dialog-form" onSubmit={(e) => void handleSubmit(e)}>
        {allowImage && (
          <div className="dialog-attachments">
            <label className="dialog-attach-button">
              📷 Прикрепить фото
              <input type="file" accept="image/*" className="dialog-attach-input" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) { setImageDataUrl(null); return; }
                const reader = new FileReader();
                reader.onloadend = () => { if (typeof reader.result === "string") setImageDataUrl(reader.result); };
                reader.readAsDataURL(file);
              }} />
            </label>
            {imageDataUrl && <span className="dialog-attach-hint">Фото прикреплено</span>}
          </div>
        )}
        {showInput && (
          <>
            <textarea className="dialog-input" placeholder={placeholder} rows={3} value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => { onInputFocusChange(true); if (clearOnFocus) { setInput(""); setClearOnFocus(false); } }}
              onBlur={() => onInputFocusChange(false)}
            />
            <button type="submit" className="spin-button" disabled={loading || !input.trim()}>{loading ? "Отправляем..." : "Отправить"}</button>
          </>
        )}
      </form>

      {showAskNext && scenario === "ask" ? (
        <div className="main-menu-list" style={{ marginTop: "1rem" }}>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("analyze")}>Разобрать технику глубже</button>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("run")}>Пройти технику</button>
        </div>
      ) : isRunFinished && scenario === "run" ? (
        <div className="main-menu-list" style={{ marginTop: "1rem" }}>
          <button type="button" className="main-menu-item" onClick={() => resetToScenario("analyze")}>Разобрать технику глубже</button>
          <button type="button" className="main-menu-item" onClick={onChooseAnotherTechnique}>Выбрать другую технику</button>
          <button type="button" className="main-menu-item" onClick={onMainMenu}>В главное меню</button>
        </div>
      ) : (
        <>
          <p className="onboarding-subtitle">Чтобы сохранить этот разбор и увидеть его позже в разделе «Мои разборы», в конце нажмите кнопку «Завершить диалог».</p>
          <button type="button" className="secondary-button" onClick={() => void handleSave()}>🛑 Завершить диалог</button>
          {fromReview && (
            <button type="button" className="secondary-button" onClick={() => onBack(entry.origin, true)}>⬅️ Назад к списку разборов</button>
          )}
        </>
      )}

      <button type="button" className="secondary-button" onClick={handleBackInternal}>Назад</button>
      {(entry.origin === "cardDecode" || entry.origin === "birthCode") && (
        <button type="button" className="secondary-button" onClick={onMainMenu}>Главное меню</button>
      )}
    </>
  );
};

export default DialogView;
