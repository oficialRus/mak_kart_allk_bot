import type React from "react";

type CabinetAuthScreenProps = {
  onRegister: () => void;
  onOpenDaily: () => void;
  onOpenMenu: () => void;
  onOpenCabinet: () => void;
};

const CabinetAuthScreen: React.FC<CabinetAuthScreenProps> = ({
  onRegister,
  onOpenDaily,
  onOpenMenu,
  onOpenCabinet,
}) => {
  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-main">
          <section className="cabinet-auth-card" aria-label="Регистрация для личного кабинета">
            <div className="cabinet-auth-card__logo" aria-hidden>
              Г
            </div>
            <p className="cabinet-auth-card__title">Добро пожаловать в ГАРМОНИЯ-МАК</p>

            <div className="cabinet-auth-card__providers">
              <button type="button" className="cabinet-auth-provider" onClick={onRegister}>
                <span className="cabinet-auth-provider__icon cabinet-auth-provider__icon--google" aria-hidden>
                  G
                </span>
                <span>Продолжить с Google</span>
              </button>
              <button type="button" className="cabinet-auth-provider" onClick={onRegister}>
                <span className="cabinet-auth-provider__icon cabinet-auth-provider__icon--yandex" aria-hidden>
                  Я
                </span>
                <span>Продолжить с Яндекс</span>
              </button>
              <button type="button" className="cabinet-auth-provider" onClick={onRegister}>
                <span className="cabinet-auth-provider__icon cabinet-auth-provider__icon--email" aria-hidden>
                  ✉
                </span>
                <span>Войти через Email</span>
              </button>
            </div>

            <p className="cabinet-auth-card__terms">Продолжая, вы соглашаетесь с условиями использования</p>
          </section>
        </div>
        <nav className="bottom-nav">
          <button type="button" className="bottom-nav-button bottom-nav-button--primary" onClick={onOpenDaily}>
            ВАША ЦИФРА ДНЯ
          </button>
          <button type="button" className="bottom-nav-button bottom-nav-button--menu" onClick={onOpenMenu}>
            Меню
          </button>
          <button
            type="button"
            className="bottom-nav-button bottom-nav-button--primary bottom-nav-button--active"
            onClick={onOpenCabinet}
          >
            Личный кабинет
          </button>
        </nav>
      </div>
    </main>
  );
};

export default CabinetAuthScreen;
