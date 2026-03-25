import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OnboardingFlow from "./OnboardingFlow";
import SplashOverlay from "./SplashOverlay";
import { isFirstLaunch, markOnboardingComplete } from "./onboardingStorage";
import "./index.css";

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
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
