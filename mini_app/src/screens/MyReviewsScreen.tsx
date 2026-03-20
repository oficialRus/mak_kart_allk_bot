import type React from "react";

type ReviewSummary = {
  id: number;
  mode: string;
  title: string;
  createdAt: string;
};

type MyReviewsScreenProps = {
  reviews: ReviewSummary[];
  loading: boolean;
  error: string | null;
  onOpenReview: (id: number) => void;
};

const MyReviewsScreen: React.FC<MyReviewsScreenProps> = ({
  reviews,
  loading,
  error,
  onOpenReview,
}) => {
  return (
    <main className="page">
      <header className="app-header">
        <img src="/logo.png" alt="Гармония-Мак — Самопознание" className="app-logo" />
      </header>
      <div className="page-inner page-inner--blue">
        <div className="page-main">
          <section className="roulette-card onboarding-card">
            <h1 className="onboarding-title">Мои разборы</h1>
            <p className="onboarding-subtitle">Здесь сохраняются ваши диалоги с ИИ‑Психологом.</p>
            {loading && <p className="technique-body">Загружаем разборы…</p>}
            {error && <p className="dialog-error">{error}</p>}
            {!loading && !error && reviews.length === 0 && (
              <p className="technique-body">На данный момент у вас нет разборов.</p>
            )}
            {!loading && !error && reviews.length > 0 && (
              <div className="main-menu-list">
                {reviews.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="main-menu-item"
                    onClick={() => onOpenReview(r.id)}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.title || "Без названия"}</div>
                      <div style={{ fontSize: "0.78rem", opacity: 0.8 }}>
                        {new Date(r.createdAt).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default MyReviewsScreen;

