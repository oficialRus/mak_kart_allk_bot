import { useEffect, useMemo, useState } from "react";
import MainMenuScreen from "./menu/MainMenuScreen";
import CabinetMenuScreen from "./cabinet/CabinetMenuScreen";
import DailyNumberScreen from "./daily/DailyNumberScreen";
import MyReviewsScreen from "./cabinet/MyReviewsScreen";
import CabinetAuthScreen from "./cabinet/CabinetAuthScreen";
import AiCoachScreen from "./menu/ai-coach/AiCoachScreen";
import OnboardingFlow from "./OnboardingFlow";
import {
  clearCabinetSessionStorage,
  hasEverCabinetVerification,
  initialCabinetAuthorizedFromStorage,
  isCabinetReauthRequired,
  parseCabinetAuthStored,
  saveCabinetSession,
  validateCabinetSessionOnServer,
} from "./cabinetSession";
import {
  SECTOR_COUNT,
  SECTOR_ANGLE,
  SPIN_DURATION_MS,
  STORAGE_KEY_PROFILE,
} from "./shared/constants";
import {
  hashStringToIndex,
  getTodayKey,
  buildDailyNumberDescription,
  getDailyAffirmationText,
} from "./shared/utils";
import type { Profile, LearningSurvey, AppScreen, AiCoachEntryMode } from "./shared/types";
import { apiCall } from "./shared/api";
import { runtime } from "./runtime";
import { exchangeTelegramToSessionIfNeeded } from "./auth/exchangeTelegram";

export default function App() {
  const WELCOME_STORAGE_KEY = "garmonia_welcome_seen_v2";
  const REAUTH_HOURS = 60;
  const [rotation, setRotation] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);
  const [dailyIndex, setDailyIndex] = useState<number | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [dailyAffirmation, setDailyAffirmation] = useState<string | null>(null);
  const [showBirthSpreadModal, setShowBirthSpreadModal] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showMainMenuScreen, setShowMainMenuScreen] = useState(false);
  const [showCabinetMenuScreen, setShowCabinetMenuScreen] = useState(false);
  const [showCabinetAuthScreen, setShowCabinetAuthScreen] = useState(false);
  const [showAiCoachScreen, setShowAiCoachScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "menu" | "cabinet">("daily");
  const [learningSurvey, setLearningSurvey] = useState<LearningSurvey | null>(null);
  const [openLearningOnNextMenu, setOpenLearningOnNextMenu] = useState(false);
  const [navigationStack, setNavigationStack] = useState<AppScreen[]>(["daily"]);
  const [showMyReviewsScreen, setShowMyReviewsScreen] = useState(false);
  const [reviews, setReviews] = useState<{ id: number; mode: string; title: string; createdAt: string }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [isCabinetAuthorized, setIsCabinetAuthorized] = useState(initialCabinetAuthorizedFromStorage);
  const [hasAcceptedWelcome, setHasAcceptedWelcome] = useState(() => {
    try {
      return window.localStorage.getItem(WELCOME_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [aiCoachEntryMode, setAiCoachEntryMode] = useState<AiCoachEntryMode>({ kind: "default" });

  // ---------- Валидация сессии кабинета ----------

  useEffect(() => {
    const s = parseCabinetAuthStored();
    if (s.kind !== "session") return;
    void (async () => {
      const ok = await validateCabinetSessionOnServer(import.meta.env.VITE_API_BASE_URL ?? "", s.token);
      if (!ok) {
        clearCabinetSessionStorage();
        setIsCabinetAuthorized(false);
      }
    })();
  }, []);

  useEffect(() => {
    const s = parseCabinetAuthStored();
    if (s.kind === "session" && new Date(s.expiresAt).getTime() > Date.now()) return;
    void (async () => {
      const exchanged = await exchangeTelegramToSessionIfNeeded();
      if (exchanged) setIsCabinetAuthorized(true);
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (isCabinetReauthRequired(REAUTH_HOURS)) {
      setIsCabinetAuthorized(false);
      setNavigationStack(["cabinetAuth"]);
      activateScreen("cabinetAuth");
      return;
    }
    setIsCabinetAuthorized(true);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiCall("/api/daily-affirmation", {});
        if (!res.ok) {
          if (!cancelled) {
            setDailyAffirmation(getDailyAffirmationText());
          }
          return;
        }
        const data = (await res.json()) as { affirmation?: string };
        const text = (data.affirmation ?? "").trim();
        if (!cancelled) {
          setDailyAffirmation(text || getDailyAffirmationText());
        }
      } catch {
        if (!cancelled) {
          setDailyAffirmation(getDailyAffirmationText());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  // ---------- Навигация ----------

  const activateScreen = (screen: AppScreen) => {
    setShowMainMenuScreen(screen === "menu");
    setShowCabinetMenuScreen(screen === "cabinet");
    setShowCabinetAuthScreen(screen === "cabinetAuth");
    setShowAiCoachScreen(screen === "aiCoach");
    setShowMyReviewsScreen(screen === "reviews");
    setShowCompass(screen === "daily");
    setActiveTab(
      screen === "menu" || screen === "aiCoach"
        ? "menu"
        : screen === "cabinet" || screen === "reviews"
          ? "cabinet"
          : "daily",
    );
  };

  const pushScreen = (screen: AppScreen) => {
    setNavigationStack((prev) => [...prev, screen]);
    activateScreen(screen);
  };

  const goBack = () => {
    setNavigationStack((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      activateScreen(next[next.length - 1]);
      return next;
    });
  };

  const openCabinetFlow = () => {
    pushScreen(isCabinetAuthorized ? "cabinet" : "cabinetAuth");
  };

  const handleResetToMainMenu = () => {
    setNavigationStack(["menu"]);
    activateScreen("menu");
  };

  // ---------- Выход из кабинета ----------

  const handleCabinetLogout = () => {
    void (async () => {
      const s = parseCabinetAuthStored();
      if (s.kind === "session") {
        try {
          await apiCall("/api/auth/cabinet/logout", { sessionToken: s.token });
        } catch {
          // ignore
        }
      }
      clearCabinetSessionStorage();
      setIsCabinetAuthorized(false);
      setNavigationStack((prev) => {
        const next = [...prev];
        while (next.length > 0 && (next[next.length - 1] === "reviews" || next[next.length - 1] === "cabinet")) {
          next.pop();
        }
        next.push("cabinetAuth");
        activateScreen("cabinetAuth");
        return next;
      });
    })();
  };

  // ---------- Expand / Fullscreen ----------

  const [initialScreen] = useState(() => {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get("screen") || "").toLowerCase();
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const w = window as unknown as {
      Telegram?: {
        WebApp?: {
          ready?: () => void;
          expand?: () => void;
          requestFullscreen?: () => void | Promise<unknown>;
          viewport?: { isExpanded?: boolean };
        };
      };
    };
    const webApp = w.Telegram?.WebApp;

    function doExpand() {
      try {
        webApp?.ready?.();
        if (webApp && !webApp.viewport?.isExpanded) webApp.expand?.();
      } catch {
        // ignore
      }
    }
    function doFullscreen() {
      try {
        if (webApp?.requestFullscreen) (webApp.requestFullscreen as () => Promise<unknown>)?.();
      } catch {
        // ignore
      }
    }

    if (!webApp) {
      return;
    }

    doExpand();
    doFullscreen();
    requestAnimationFrame(() => {
      doExpand();
      doFullscreen();
    });
    const t = window.setTimeout(() => {
      doExpand();
      doFullscreen();
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // ---------- Профиль ----------

  useEffect(() => {
    if (runtime.isTelegram || parseCabinetAuthStored().kind === "session") {
      void (async () => {
        try {
          const res = await apiCall("/api/profile-get", {});

          if (!res.ok) {
            return;
          }

          const data = (await res.json()) as {
            fullName?: string;
            birthDate?: string;
            learningLevel?: string;
            learningGoal?: string;
            learningFormat?: string;
          };
          setProfile({ v: 1 });
          if (data.learningLevel && data.learningGoal && data.learningFormat) {
            setLearningSurvey({
              level: data.learningLevel as LearningSurvey["level"],
              goal: data.learningGoal as LearningSurvey["goal"],
              format: data.learningFormat as LearningSurvey["format"],
            });
          }
          setNavigationStack(["menu"]);
          activateScreen("menu");
          try {
            window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify({ v: 1 } satisfies Profile));
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const legacyOk =
        typeof parsed === "object" &&
        parsed !== null &&
        "fullName" in parsed &&
        "birthDate" in parsed &&
        typeof (parsed as { fullName: unknown }).fullName === "string" &&
        typeof (parsed as { birthDate: unknown }).birthDate === "string";
      const modernOk =
        typeof parsed === "object" && parsed !== null && (parsed as { v?: unknown }).v === 1;
      if (!legacyOk && !modernOk) return;
      setProfile({ v: 1 });
      setNavigationStack(["menu"]);
      activateScreen("menu");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (profile && initialScreen === "main_menu") {
      setNavigationStack(["menu"]);
      activateScreen("menu");
    }
  }, [profile, initialScreen]);

  // ---------- Цифра дня ----------

  useEffect(() => {
    if (!profile) return;
    const initData = runtime.initData;

    const computeFallbackIndex = () => {
      const todayKey = getTodayKey();
      const key = `${todayKey}|${initData}|garmonia_daily_v1`;
      const idx = hashStringToIndex(key, SECTOR_COUNT);
      setDailyIndex(idx);
      setWinningIndex(null);
      setHasResult(false);
      setDailyMessage(null);
    };

    if (!runtime.isTelegram && parseCabinetAuthStored().kind !== "session") {
      computeFallbackIndex();
      return;
    }

    (async () => {
      try {
        const res = await apiCall("/api/daily-number", {});
        if (!res.ok) {
          console.warn("daily-number API error:", res.status, await res.text());
          computeFallbackIndex();
          return;
        }
        const data = (await res.json()) as { index: number; num: number; message?: string };
        if (typeof data.index === "number" && data.index >= 0 && data.index < SECTOR_COUNT) {
          setDailyIndex(data.index);
          setWinningIndex(null);
          setHasResult(false);
          setDailyMessage(typeof data.message === "string" && data.message.trim() ? data.message.trim() : null);
        } else {
          computeFallbackIndex();
        }
      } catch (err) {
        console.warn("daily-number API request failed:", err);
        computeFallbackIndex();
      }
    })();
  }, [profile]);

  // ---------- Обработчики ----------

  const startRegistrationFlow = async () => {
    if (isRegisterSubmitting) return;
    setIsRegisterSubmitting(true);
    try {
      window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify({ v: 1 } satisfies Profile));
    } catch {
      // ignore
    }
    try {
      const res = await apiCall("/api/profile", { fullName: "", birthDate: "" });
      if (!res.ok) {
        console.warn("Profile API error:", res.status, await res.text());
      }
    } catch (e) {
      console.warn("Profile API request failed:", e);
    }
    setProfile({ v: 1 });
    setNavigationStack(["cabinetAuth"]);
    activateScreen("cabinetAuth");
    setIsRegisterSubmitting(false);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startRegistrationFlow();
  };

  const handleOnboardingComplete = async () => {
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setHasAcceptedWelcome(true);
    await startRegistrationFlow();
  };

  const resultNumber = winningIndex === null ? "-" : winningIndex + 1;

  const handleSpin = () => {
    if (isSpinning) {
      return;
    }

    if (profile == null || dailyIndex === null) {
      return;
    }

    setIsSpinning(true);
    setWinningIndex(null);

    const nextWinningIndex = dailyIndex;
    const segmentCenterDeg = -90 + (nextWinningIndex + 0.5) * SECTOR_ANGLE;
    const pointerAngle = 90;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const delta = segmentCenterDeg - pointerAngle - normalizedRotation;
    const targetOffset = ((delta % 360) + 360) % 360;
    const extraSpins = 5 + Math.floor(Math.random() * 2);
    const nextRotation = rotation + extraSpins * 360 + targetOffset;

    setRotation(nextRotation);

    window.setTimeout(() => {
      setWinningIndex(nextWinningIndex);
      setIsSpinning(false);
      setHasResult(true);
    }, SPIN_DURATION_MS);
  };

  const dailyNumberDescription = useMemo(() => {
    if (dailyIndex == null) return null;
    return buildDailyNumberDescription(dailyIndex + 1);
  }, [dailyIndex]);

  const handleLoadReviews = async () => {
    setReviewsError(null);
    setReviewsLoading(true);
    try {
      const res = await apiCall("/api/dialogs", { limit: 50 });
      if (!res.ok) {
        const msg = await res.text();
        setReviewsError(msg || "Не удалось получить список разборов.");
        return;
      }
      const data = (await res.json()) as { id: number; mode: string; title: string; createdAt: string }[] | null;
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviewsError("Произошла ошибка сети. Попробуйте ещё раз.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleOpenReview = async (id: number) => {
    try {
      const res = await apiCall("/api/dialog", { id }, { method: "GET" });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        id: number;
        mode: string;
        title: string;
        createdAt: string;
        messages: { from: "user" | "ai"; text: string }[];
      };
      setAiCoachEntryMode({ kind: "review", messages: data.messages });
      pushScreen("aiCoach");
    } catch {
      // ignore
    }
  };

  const handleSaveLearningSurvey = async (payload: LearningSurvey): Promise<boolean> => {
    if (!profile) return false;
    try {
      const res = await apiCall("/api/profile", {
        fullName: "",
        birthDate: "",
        learningLevel: payload.level,
        learningGoal: payload.goal,
        learningFormat: payload.format,
      });
      if (!res.ok) return false;
      setLearningSurvey(payload);
      return true;
    } catch {
      return false;
    }
  };

  // ---------- Рендеринг ----------

  if (!profile) {
    if (!hasAcceptedWelcome) {
      return (
        <main className="page">
          <div className="page-inner">
            <div className="page-main">
              <OnboardingFlow onComplete={() => void handleOnboardingComplete()} />
            </div>
          </div>
        </main>
      );
    }
    return (
      <main className="page">
        <header className="app-header">
          <img src="/api/card-image?name=logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
        </header>

        <div className="page-inner">
          <div className="page-main">
            <section className="roulette-card onboarding-card">
              <h1 className="onboarding-title">Добро пожаловать</h1>
              <p className="onboarding-subtitle">
                Нажмите «Начать», затем подтвердите email, чтобы получить доступ к функционалу.
              </p>
              <form className="onboarding-form" onSubmit={handleProfileSubmit}>
                <button type="submit" className="spin-button" disabled={isRegisterSubmitting}>
                  {isRegisterSubmitting ? "Открываем…" : "Начать"}
                </button>
              </form>
            </section>
          </div>

        </div>
      </main>
    );
  }

  if (showCabinetAuthScreen) {
    return (
      <CabinetAuthScreen
        authMode={hasEverCabinetVerification() ? "login" : "register"}
        blocking
        onOpenDaily={() => {
          pushScreen("daily");
        }}
        onOpenMenu={() => {
          pushScreen("menu");
        }}
        onOpenCabinet={() => {
          openCabinetFlow();
        }}
        onCabinetEmailVerified={(session) => {
          if (session) {
            saveCabinetSession(session.token, session.expiresAt);
          }
          setIsCabinetAuthorized(true);
          setOpenLearningOnNextMenu(false);
          pushScreen("menu");
        }}
      />
    );
  }

  if (showCabinetMenuScreen) {
    return (
      <CabinetMenuScreen
        onOpenDaily={() => {
          pushScreen("daily");
        }}
        onOpenMenu={() => {
          pushScreen("menu");
        }}
        onOpenMyReviews={() => {
          pushScreen("reviews");
          void handleLoadReviews();
        }}
        onLogout={handleCabinetLogout}
        activeTab={activeTab}
      />
    );
  }

  if (showAiCoachScreen) {
    return (
      <AiCoachScreen
        activeTab={activeTab}
        entryMode={aiCoachEntryMode}
        onNavigateToDaily={() => pushScreen("daily")}
        onNavigateToMenu={() => pushScreen("menu")}
        onNavigateToCabinet={() => openCabinetFlow()}
        onGoBack={goBack}
        onResetToMainMenu={handleResetToMainMenu}
      />
    );
  }

  if (showMyReviewsScreen) {
    return (
      <MyReviewsScreen
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        onOpenReview={handleOpenReview}
        onBack={goBack}
        onMainMenu={handleResetToMainMenu}
      />
    );
  }

  if (showMainMenuScreen) {
    return (
      <MainMenuScreen
        onOpenDaily={() => {
          pushScreen("daily");
        }}
        onOpenCabinet={() => {
          openCabinetFlow();
        }}
        onOpenAiCoach={() => {
          setAiCoachEntryMode({ kind: "default" });
          pushScreen("aiCoach");
        }}
        autoOpenLearning={openLearningOnNextMenu}
        onLearningAutoOpened={() => {
          setOpenLearningOnNextMenu(false);
        }}
        onOpenDigitalPsychologist={() => {
          setAiCoachEntryMode({ kind: "dialog" });
          pushScreen("aiCoach");
        }}
        learningSurvey={learningSurvey}
        onSaveLearningSurvey={handleSaveLearningSurvey}
      />
    );
  }

  return (
    <DailyNumberScreen
      showCompass={showCompass}
      rotation={rotation}
      isSpinning={isSpinning}
      hasResult={hasResult}
      resultNumber={resultNumber}
      dailyMessage={dailyMessage}
      dailyAffirmation={dailyAffirmation}
      dailyNumberDescription={dailyNumberDescription}
      showBirthSpreadModal={showBirthSpreadModal}
      onSpin={handleSpin}
      onOpenMenu={() => {
        pushScreen("menu");
      }}
      onOpenCabinet={() => {
        openCabinetFlow();
      }}
      onOpenBirthSpreadModal={() => setShowBirthSpreadModal(true)}
      onCloseBirthSpreadModal={() => setShowBirthSpreadModal(false)}
      activeTab={activeTab}
    />
  );
}
