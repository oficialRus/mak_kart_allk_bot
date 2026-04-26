import type React from "react";

/** Лёгкое мерцание звёзд на фоне карточки (таинственно, без «магии»). */
type CardStarAtmosphereProps = {
  className?: string;
};

const CardStarAtmosphere: React.FC<CardStarAtmosphereProps> = ({ className }) => (
  <div className={`main-menu-atmosphere ${className ?? ""}`} aria-hidden>
    <span className="main-menu-star main-menu-star--1">✦</span>
    <span className="main-menu-star main-menu-star--2">✧</span>
    <span className="main-menu-star main-menu-star--3">✦</span>
    <span className="main-menu-star main-menu-star--4">✧</span>
    <span className="main-menu-star main-menu-star--5">✦</span>
  </div>
);

export default CardStarAtmosphere;
