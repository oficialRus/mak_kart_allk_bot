import { useEffect, useRef } from "react";

/** Совпадает с файлом в `public/splash-logo.png` (бренд-логотип при запуске). */
export const SPLASH_LOGO_SRC = "/splash-logo.png";

const SPLASH_MIN_MS = 3000;

type Props = {
  onFinished: () => void;
};

function waitForImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = src;
    if (img.complete) done();
  });
}

export default function SplashOverlay({ onFinished }: Props) {
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      onFinished();
    };

    void Promise.all([
      waitForImage(SPLASH_LOGO_SRC),
      new Promise<void>((r) => window.setTimeout(r, SPLASH_MIN_MS)),
    ]).then(() => {
      if (!cancelled) finish();
    });

    return () => {
      cancelled = true;
    };
  }, [onFinished]);

  return (
    <div className="splash-overlay" aria-hidden>
      <img
        src={SPLASH_LOGO_SRC}
        alt=""
        className="splash-overlay__logo"
        width={1024}
        height={1024}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
