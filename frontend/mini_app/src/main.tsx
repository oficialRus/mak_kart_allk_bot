import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OnboardingFlow from "./OnboardingFlow";
import PwaInstallPrompt from "./PwaInstallPrompt";
import SplashOverlay from "./SplashOverlay";
import { isFirstLaunch, markOnboardingComplete } from "./onboardingStorage";
import { runtime, shouldRegisterServiceWorker } from "./runtime";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Этап 0 PWA: среда для стилей/телеметрии; SW подключать только при runtime.isPwaEnvironment
document.documentElement.setAttribute(
  "data-app-shell",
  runtime.isTelegram ? "telegram" : "browser",
);

if (shouldRegisterServiceWorker()) {
  registerSW({ immediate: true });
}

function Root() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const onSplashFinished = useCallback(() => {
    setShowSplash(false);
    if (isFirstLaunch()) {
      setShowOnboarding(true);
    }
  }, []);

  const onOnboardingFinished = useCallback(() => {
    markOnboardingComplete();
    setShowOnboarding(false);
  }, []);

  const appReady = !showSplash && !showOnboarding;

  return (
    <>
      {showSplash ? <SplashOverlay onFinished={onSplashFinished} /> : null}
      {showOnboarding ? <OnboardingFlow onComplete={onOnboardingFinished} /> : null}
      {appReady ? <App /> : null}
      {appReady ? <PwaInstallPrompt /> : null}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
