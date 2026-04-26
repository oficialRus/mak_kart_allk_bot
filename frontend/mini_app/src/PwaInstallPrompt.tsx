import { useEffect, useState } from "react";
import { runtime } from "./runtime";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!runtime.isPwaEnvironment || runtime.isStandalone) return;
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!deferred || hidden) return null;

  return (
    <button
      type="button"
      className="secondary-button"
      style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999 }}
      onClick={() => {
        void (async () => {
          await deferred.prompt();
          await deferred.userChoice.catch(() => undefined);
          setDeferred(null);
          setHidden(true);
        })();
      }}
    >
      Установить приложение
    </button>
  );
}
