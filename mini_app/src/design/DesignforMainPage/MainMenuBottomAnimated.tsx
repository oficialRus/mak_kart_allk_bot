import React, { useEffect, useRef, useState } from "react";
import "./MainMenuBottomAnimated.css";

type Star = {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  speed: number;
  phase: number;
};

const MainMenuBottomAnimated: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Стартуем только когда блок реально появляется на экране,
    // чтобы звёзды и текст не выглядели «разделёнными».
    if (typeof IntersectionObserver === "undefined") {
      // Fallback для окружений, где IntersectionObserver недоступен.
      setIsStarted(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setIsStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    obs.observe(wrap);

    // Если по какой-то причине наблюдатель не сработал (например, особенности контейнера),
    // всё равно включаем анимацию после короткой задержки.
    const t = window.setTimeout(() => {
      setIsStarted(true);
      obs.disconnect();
    }, 600);

    return () => {
      window.clearTimeout(t);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isStarted) return;

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    let raf: number | null = null;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars: Star[] = [];

    const rebuild = () => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Плотность звёзд подстраиваем под размеры блока,
      // чтобы в "большом звёздном небе" их было визуально больше.
      const area = Math.max(1, w * h);
      const count = Math.round(Math.min(240, Math.max(120, area / 600)));
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.9 + Math.random() * 2.2, // ~1–3px
        baseAlpha: 0.3 + Math.random() * 0.7,
        speed: 0.6 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        // Мерцание только через opacity; без движения и параллакса.
        const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase); // [0..1]
        const alpha = Math.max(0.3, Math.min(1, 0.3 + 0.7 * tw)) * s.baseAlpha;
        ctx.fillStyle = `rgba(243, 234, 208, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    rebuild();
    if (!reducedMotion) {
      raf = requestAnimationFrame(draw);
    } else {
      draw(performance.now());
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    const onResize = () => rebuild();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isStarted]);

  return (
    <div ref={wrapRef} className={`main-menu-bottom ${isStarted ? "main-menu-bottom--started" : ""}`}>
      <canvas ref={canvasRef} className="main-menu-bottom__canvas" />
      <div className="main-menu-bottom__label">
        <div className="main-menu-bottom__title">ГАРМОНИЯ-МАК</div>
        <div className="main-menu-bottom__subtitle">Самопознание</div>
      </div>
    </div>
  );
};

export default MainMenuBottomAnimated;

