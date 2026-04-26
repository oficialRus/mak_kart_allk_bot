import type React from "react";
import { TECHNIQUES } from "../../shared/constants";

type Props = {
  selectedTechniqueId: number | null;
  onSelectTechnique: (id: number) => void;
  onDeselectTechnique: () => void;
  onOpenDialog: () => void;
  onBack: () => void;
  onMainMenu: () => void;
};

const TechniquesView: React.FC<Props> = ({
  selectedTechniqueId,
  onSelectTechnique,
  onDeselectTechnique,
  onOpenDialog,
  onBack,
  onMainMenu,
}) => {
  const selectedTechnique =
    selectedTechniqueId != null ? TECHNIQUES.find((t) => t.id === selectedTechniqueId) ?? null : null;

  return (
    <>
      <p className="onboarding-subtitle">Выберите технику, чтобы прочитать подробное описание.</p>
      {!selectedTechnique && (
        <div className="main-menu-list">
          {TECHNIQUES.map((t) => (
            <button key={t.id} type="button" className="main-menu-item" onClick={() => onSelectTechnique(t.id)}>
              {t.title}
            </button>
          ))}
        </div>
      )}
      {selectedTechnique && (
        <>
          <div className="technique-text">
            <h2 className="technique-title">{selectedTechnique.title}</h2>
            <p className="technique-body">{selectedTechnique.text}</p>
          </div>
          <p className="technique-scroll-hint">Проведите вверх, чтобы прочитать технику полностью</p>
          <button type="button" className="spin-button" style={{ marginTop: "0.4rem" }} onClick={onOpenDialog}>
            Разобрать технику с ИИ‑психологом
          </button>
        </>
      )}
      <button
        type="button"
        className="secondary-button"
        onClick={selectedTechnique ? onDeselectTechnique : onBack}
      >
        Назад
      </button>
      <button type="button" className="secondary-button" onClick={onMainMenu}>
        Главное меню
      </button>
    </>
  );
};

export default TechniquesView;
