import { useMemo, useState } from "react";
import CardStarAtmosphere from "../../components/CardStarAtmosphere";
import { getDailyHoroscopeBlocks } from "../../horoscope/dailyHoroscope";
import type { AiCoachEntryMode, BirthCodeAnalysisContext, DialogOrigin } from "../../shared/types";
import AiCoachMenu from "./AiCoachMenu";
import TechniquesView from "./TechniquesView";
import CardDecodeView from "./CardDecodeView";
import CardDayView from "./CardDayView";
import BirthCodeView from "./BirthCodeView";
import DialogView, { type DialogEntry } from "./DialogView";
import HoroscopeView from "./HoroscopeView";
import AffirmationView from "./AffirmationView";

type ActiveView = "menu" | "techniques" | "cardDecode" | "cardDay" | "birthCode" | "dialog" | "horoscope" | "affirmation";

type Props = {
  activeTab: "daily" | "menu" | "cabinet";
  entryMode: AiCoachEntryMode;
  onNavigateToDaily: () => void;
  onNavigateToMenu: () => void;
  onNavigateToCabinet: () => void;
  onGoBack: () => void;
  onResetToMainMenu: () => void;
};

function buildInitialView(entryMode: AiCoachEntryMode): ActiveView {
  return entryMode.kind === "dialog" || entryMode.kind === "review" ? "dialog" : "menu";
}

function buildInitialDialogEntry(entryMode: AiCoachEntryMode): DialogEntry | null {
  if (entryMode.kind === "dialog") {
    return { origin: "none", initialMessages: [], fromReview: false, allowImage: true, techniqueId: null };
  }
  if (entryMode.kind === "review") {
    return { origin: "review", initialMessages: entryMode.messages, fromReview: true, allowImage: false, techniqueId: null };
  }
  return null;
}

const AiCoachScreen: React.FC<Props> = ({
  activeTab,
  entryMode,
  onNavigateToDaily,
  onNavigateToMenu,
  onNavigateToCabinet,
  onGoBack,
  onResetToMainMenu,
}) => {
  const [activeView, setActiveView] = useState<ActiveView>(() => buildInitialView(entryMode));
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<number | null>(null);
  const [birthCodeContext, setBirthCodeContext] = useState<BirthCodeAnalysisContext | null>(null);
  const [dialogEntry, setDialogEntry] = useState<DialogEntry | null>(() => buildInitialDialogEntry(entryMode));
  const [isDialogInputFocused, setIsDialogInputFocused] = useState(false);

  const horoscopeBlocks = useMemo(() => {
    if (activeView !== "horoscope") return [];
    return getDailyHoroscopeBlocks(new Date());
  }, [activeView]);

  const openDialog = (entry: DialogEntry) => {
    setDialogEntry(entry);
    setActiveView("dialog");
  };

  const handleDialogBack = (origin: DialogOrigin, fromReview: boolean) => {
    if (origin === "review" || fromReview) {
      onGoBack();
      return;
    }
    if (origin === "cardDay") { setActiveView("cardDay"); return; }
    if (origin === "cardDecode") { setActiveView("cardDecode"); return; }
    if (origin === "birthCode") { setActiveView("birthCode"); return; }
    if (origin === "technique") { setActiveView("techniques"); return; }
    onResetToMainMenu();
  };

  return (
    <main className="page">
      <header className="app-header">
        <img src="/api/card-image?name=logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue">
        <div className="page-main">
          <section className="roulette-card onboarding-card roulette-card--stars">
            <CardStarAtmosphere />
            <h1 className="onboarding-title">ИИ‑Психолог Коуч</h1>

            {activeView === "menu" && (
              <AiCoachMenu
                onOpenTechniques={() => { setSelectedTechniqueId(null); setActiveView("techniques"); }}
                onOpenCardDecode={() => setActiveView("cardDecode")}
                onOpenCardDay={() => setActiveView("cardDay")}
                onOpenAffirmation={() => setActiveView("affirmation")}
                onOpenHoroscope={() => setActiveView("horoscope")}
                onOpenBirthCode={() => { setBirthCodeContext(null); setActiveView("birthCode"); }}
                onBack={onGoBack}
              />
            )}

            {activeView === "techniques" && (
              <TechniquesView
                selectedTechniqueId={selectedTechniqueId}
                onSelectTechnique={setSelectedTechniqueId}
                onDeselectTechnique={() => setSelectedTechniqueId(null)}
                onOpenDialog={() => {
                  openDialog({ origin: "technique", initialMessages: [], fromReview: false, allowImage: false, techniqueId: selectedTechniqueId });
                }}
                onBack={() => setActiveView("menu")}
                onMainMenu={onResetToMainMenu}
              />
            )}

            {activeView === "cardDecode" && (
              <CardDecodeView
                onStartDialog={() => {
                  openDialog({
                    origin: "cardDecode",
                    initialMessages: [{ from: "user", text: "Хочу разобрать карту, которую сейчас вижу. Я опишу, что на ней изображено и что я чувствую, а вы помогите мне расшифровать её смысл." }],
                    fromReview: false,
                    allowImage: false,
                    techniqueId: null,
                  });
                }}
                onBack={() => setActiveView("menu")}
                onMainMenu={onResetToMainMenu}
              />
            )}

            {activeView === "cardDay" && (
              <CardDayView
                onDialogWithAi={(card) => {
                  const userMessage = [
                    "Хочу разобрать мою карту дня с ИИ‑психологом.",
                    card.title ? `Название карты: ${card.title}` : "",
                    card.description ? `Описание карты: ${card.description}` : "",
                  ].filter(Boolean).join("\n\n");
                  openDialog({
                    origin: "cardDay",
                    initialMessages: [{ from: "user", text: userMessage }],
                    fromReview: false,
                    allowImage: false,
                    techniqueId: null,
                    autoSend: { userMessage, imagePath: card.imagePath },
                  });
                }}
                onBack={() => setActiveView("menu")}
                onMainMenu={onResetToMainMenu}
              />
            )}

            {activeView === "birthCode" && (
              <BirthCodeView
                initialContext={birthCodeContext}
                onContextCreated={setBirthCodeContext}
                onDiscussWithAi={(reportText) => {
                  openDialog({
                    origin: "birthCode",
                    initialMessages: [{ from: "user", text: reportText }],
                    fromReview: false,
                    allowImage: false,
                    techniqueId: null,
                  });
                }}
                onBack={() => setActiveView("menu")}
                onMainMenu={onResetToMainMenu}
              />
            )}

            {activeView === "dialog" && dialogEntry && (
              <DialogView
                entry={dialogEntry}
                onBack={handleDialogBack}
                onMainMenu={onResetToMainMenu}
                onChooseAnotherTechnique={() => { setSelectedTechniqueId(null); setActiveView("techniques"); }}
                onInputFocusChange={setIsDialogInputFocused}
              />
            )}

            {activeView === "horoscope" && (
              <HoroscopeView horoscopeBlocks={horoscopeBlocks} onBack={() => setActiveView("menu")} />
            )}

            {activeView === "affirmation" && (
              <AffirmationView onBack={() => setActiveView("menu")} />
            )}
          </section>
        </div>
        <nav className={`bottom-nav ${isDialogInputFocused ? "bottom-nav--hidden" : ""}`}>
          <button type="button" className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "daily" ? "bottom-nav-button--active" : ""}`} onClick={onNavigateToDaily}>
            ВАША ЦИФРА ДНЯ
          </button>
          <button type="button" className={`bottom-nav-button bottom-nav-button--menu ${activeTab === "menu" ? "bottom-nav-button--active" : ""}`} onClick={onNavigateToMenu}>
            Меню
          </button>
          <button type="button" className={`bottom-nav-button bottom-nav-button--primary ${activeTab === "cabinet" ? "bottom-nav-button--active" : ""}`} onClick={onNavigateToCabinet}>
            Личный кабинет
          </button>
        </nav>
      </div>
    </main>
  );
};

export default AiCoachScreen;
