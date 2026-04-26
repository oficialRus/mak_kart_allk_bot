import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { getOrCreateCabinetDeviceId } from "../cabinetDeviceId";
import { runtime } from "../runtime";
import { apiCall } from "../shared/api";

type CabinetAuthScreenProps = {
  onCabinetEmailVerified: (session?: { token: string; expiresAt: string }) => void;
  onOpenDaily: () => void;
  onOpenMenu: () => void;
  onOpenCabinet: () => void;
  authMode?: "register" | "login";
  blocking?: boolean;
};

function getInitData(): string {
  return runtime.initData;
}

type SendCodeResponse = {
  ok?: boolean;
  delivery?: string;
  error?: string;
  retryAfterSeconds?: number;
};

type DeliveryMode = "smtp" | "log_only" | "telegram" | "telegram_smtp";
type LegalModalType = "terms" | "privacy" | null;

const USER_AGREEMENT_TEXT = `Настоящее Пользовательское соглашение (далее — Соглашение) регулирует отношения между владельцем сайта https://app.garmonia-mak.ru/ (далее — Администрация) и пользователем сайта (далее — Пользователь). Используя сайт и сервисы, размещённые на https://app.garmonia-mak.ru/, Пользователь подтверждает своё согласие с условиями настоящего Соглашения. В случае несогласия с условиями Соглашения Пользователь обязан прекратить использование сайта. Пользователь имеет право осуществлять поиск и получение информации на сайте, использовать функционал сайта в личных целях, использовать материалы сайта в некоммерческих целях, а также в коммерческих целях только с письменного разрешения Администрации или правообладателей. Администрация имеет право по своему усмотрению изменять, дополнять или удалять правила и функционал сайта, ограничивать доступ к сайту или отдельным его разделам без объяснения причин, а также изменять, удалять или добавлять любую информацию и контент. Пользователь обязуется не предпринимать действий, направленных на нарушение работоспособности сайта, не использовать автоматизированные скрипты (включая парсеры и ботов) для сбора информации или взаимодействия с сервисами сайта, а также не нарушать права третьих лиц и действующее законодательство при использовании сайта. Администрация обязуется по возможности обеспечивать работоспособность сайта и его сервисов и предпринимать разумные меры для поддержания стабильной работы ресурса. Администрация не гарантирует абсолютную точность и актуальность размещённой информации, не несёт ответственности за возможные несоответствия ожиданий Пользователя и фактически полученных результатов от использования сервиса, не несёт ответственности за действия третьих лиц, а также за технические сбои, перебои в работе сайта, потерю данных или ограничение доступа к сервису. Администрация освобождается от ответственности в случае наступления форс-мажорных обстоятельств, включая, но не ограничиваясь, чрезвычайные ситуации, сбои в работе инфраструктуры и действия государственных органов. Настоящее Соглашение вступает в силу с момента начала использования сайта. Администрация вправе в любое время изменять условия Соглашения без предварительного уведомления Пользователей, при этом актуальная версия Соглашения всегда доступна на сайте. Продолжение использования сайта после внесения изменений означает согласие Пользователя с новой редакцией Соглашения.`;

const PRIVACY_AND_COOKIE_TEXT = `Соглашение на обработку персональных данных. Предоставляя свои персональные данные на сайте https://app.garmonia-mak.ru/ (далее — Сайт), Пользователь даёт согласие на обработку, хранение и использование своих персональных данных Администрацией сайта в соответствии с требованиями действующего законодательства, включая ФЗ № 152-ФЗ «О персональных данных» от 27.07.2006 г., в следующих целях: осуществление клиентской поддержки, предоставление Пользователю информации о сервисах, обновлениях и маркетинговых активностях, проведение внутренних аналитических и статистических исследований с целью улучшения качества работы сервиса. Под персональными данными понимается любая информация, позволяющая прямо или косвенно идентифицировать Пользователя, включая, но не ограничиваясь: фамилия, имя, отчество, дата рождения, контактный телефон, адрес электронной почты, а также иные данные, предоставляемые Пользователем при использовании Сайта. Персональные данные обрабатываются с использованием автоматизированных средств и могут храниться на электронных носителях, за исключением случаев, когда иная форма обработки требуется в соответствии с законодательством. Администрация обязуется не передавать персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством, а также случаев, когда передача необходима для обеспечения функционирования Сайта и предоставления услуг (например, партнёрам и подрядчикам, обеспечивающим техническую работу сервиса), при этом передаётся только минимально необходимый объём данных. Пользователь соглашается с тем, что его данные могут быть переданы уполномоченным государственным органам по основаниям и в порядке, установленным законодательством. Администрация принимает разумные организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения. Администрация вправе вносить изменения в настоящее Соглашение без предварительного уведомления, при этом актуальная версия всегда доступна на Сайте, а продолжение использования Сайта означает согласие Пользователя с внесёнными изменениями. Политика использования файлов cookie. Сайт https://app.garmonia-mak.ru/ использует файлы cookie и аналогичные технологии для обеспечения корректной работы сервиса, сохранения пользовательских настроек, сбора аналитической информации и улучшения пользовательского опыта. Файлы cookie представляют собой небольшие текстовые файлы, которые сохраняются на устройстве Пользователя и позволяют распознавать устройство, а также собирать техническую информацию, такую как IP-адрес, тип устройства, операционная система, время посещения и действия на сайте, при этом идентификация конкретной личности напрямую не осуществляется. Использование cookie позволяет оптимизировать работу Сайта, ускорять навигацию, запоминать предпочтения Пользователя и повышать релевантность отображаемого контента. Часть файлов cookie может устанавливаться сторонними сервисами, используемыми для аналитики и улучшения работы Сайта, включая, но не ограничиваясь: Яндекс.Метрика и Google Analytics. Пользователь может управлять файлами cookie через настройки своего браузера или устройства, включая возможность их удаления или блокировки, однако это может повлиять на корректность работы Сайта и доступность отдельных функций.`;

function parseDelivery(d: string | undefined): DeliveryMode {
  if (d === "log_only") return "log_only";
  if (d === "telegram") return "telegram";
  if (d === "telegram_smtp") return "telegram_smtp";
  return "smtp";
}

const CabinetAuthScreen: React.FC<CabinetAuthScreenProps> = ({
  onCabinetEmailVerified,
  onOpenDaily,
  onOpenMenu,
  onOpenCabinet,
  authMode = "register",
  blocking = false,
}) => {
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  /** Как доставлен код: реальное письмо или только запись в лог сервера (SMTP не настроен). */
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const startCooldown = useCallback((secs: number) => {
    const s = Math.max(0, Math.min(secs, 3600));
    setCooldownSec(s);
  }, []);

  const handleSendCode = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Введите корректный email.");
      return;
    }
    const initData = getInitData();
    const cabinetDeviceId = getOrCreateCabinetDeviceId();
    setLoadingSend(true);
    try {
      const res = await apiCall("/api/auth/email/send-code", {
        email: trimmed,
        cabinetDeviceId,
        ...(initData ? { initData } : {}),
      }, { includeInitDataFallback: false });
      const data = (await res.json().catch(() => ({}))) as SendCodeResponse & { error?: string };
      if (res.ok) {
        setDeliveryMode(parseDelivery(data.delivery));
        setPhase("code");
        startCooldown(60);
        return;
      }
      if (res.status === 429) {
        if (typeof data.retryAfterSeconds === "number") {
          startCooldown(data.retryAfterSeconds);
        }
        setError("Слишком частые запросы. Подождите и попробуйте снова.");
        return;
      }
      if (res.status === 400) {
        if (data.error === "email_blocked") {
          setError(
            "Этот email уже привязан к другому устройству или способу входа. Войдите с того же браузера/приложения, где подтверждали почту, или напишите в поддержку.",
          );
          return;
        }
        setError("Проверьте email и попробуйте снова.");
        return;
      }
      if (res.status === 401) {
        setError("Не удалось подтвердить вход. Обновите страницу или откройте приложение из Telegram и попробуйте снова.");
        return;
      }
      if (res.status === 502) {
        setError(
          "Сервер не смог отправить письмо (ошибка SMTP). Проверьте на сервере SMTP_HOST, SMTP_PORT, логин, пароль, SMTP_FROM и SMTP_USE_TLS (для порта 587 обычно TLS включён).",
        );
        return;
      }
      if (res.status === 404 || res.status === 405) {
        setError("Запрос к серверу не найден. Проверьте адрес API (VITE_API_BASE_URL) и что бот/API обновлены.");
        return;
      }
      if (res.status === 500 || res.status === 503) {
        if (data.error === "service_unavailable") {
          setError(
            "Сервер не готов отправлять коды: задайте EMAIL_OTP_SECRET или убедитесь, что задан BOT_TOKEN; для теста включите EMAIL_OTP_DEV_LOG=1.",
          );
          return;
        }
        if (data.error === "internal_error") {
          setError("Ошибка на сервере при отправке кода. Попробуйте позже или обратитесь в поддержку.");
          return;
        }
        setError("Сервер временно недоступен. Попробуйте позже.");
        return;
      }
      setError("Что-то пошло не так. Попробуйте позже.");
    } catch {
      setError("Нет сети или сервер недоступен.");
    } finally {
      setLoadingSend(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    const digits = code.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) {
      setError("Введите 6 цифр кода из письма.");
      return;
    }
    const initData = getInitData();
    const cabinetDeviceId = getOrCreateCabinetDeviceId();
    setLoadingVerify(true);
    try {
      const res = await apiCall("/api/auth/email/verify-code", {
        email: email.trim(),
        code: digits,
        cabinetDeviceId,
        ...(initData ? { initData } : {}),
      }, { includeInitDataFallback: false });
      const verifyData = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sessionToken?: string;
        sessionExpiresAt?: string;
        error?: string;
      };
      if (res.ok) {
        if (typeof verifyData.sessionToken === "string" && typeof verifyData.sessionExpiresAt === "string") {
          onCabinetEmailVerified({ token: verifyData.sessionToken, expiresAt: verifyData.sessionExpiresAt });
        } else {
          onCabinetEmailVerified();
        }
        return;
      }
      const data = verifyData;
      if (res.status === 400 && data.error === "verification_failed") {
        setError("Неверный или просроченный код. Запросите новый, если нужно.");
        return;
      }
      if (res.status === 401) {
        setError("Не удалось подтвердить вход. Обновите страницу или откройте приложение из Telegram и попробуйте снова.");
        return;
      }
      if (res.status === 500 || res.status === 503) {
        if (data.error === "service_unavailable") {
          setError("Сервер не настроен для проверки кода (секрет OTP). Обратитесь к администратору.");
          return;
        }
        setError("Ошибка сервера при проверке кода. Попробуйте позже.");
        return;
      }
      setError("Не удалось подтвердить код. Попробуйте снова.");
    } catch {
      setError("Нет сети или сервер недоступен.");
    } finally {
      setLoadingVerify(false);
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-main">
          <section className="cabinet-auth-card" aria-label="Подтверждение email для личного кабинета">
            <div className="cabinet-auth-card__logo" aria-hidden>
              <img className="cabinet-auth-card__logo-image" src="/cabinet-auth-logo-v2.png" alt="" />
            </div>
            <p className="cabinet-auth-card__title">
              {authMode === "login" ? "Войдите в кабинет через email" : "Подтвердите email для регистрации"}
            </p>

            {phase === "email" ? (
              <div className="cabinet-auth-email-form">
                <label className="cabinet-auth-field">
                  <span className="cabinet-auth-field__label">Email</span>
                  <input
                    type="email"
                    className="cabinet-auth-field__input"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loadingSend}
                  />
                </label>
                <button
                  type="button"
                  className="cabinet-auth-primary"
                  onClick={() => void handleSendCode()}
                  disabled={loadingSend || cooldownSec > 0}
                >
                  {loadingSend ? "Отправка…" : cooldownSec > 0 ? `Повтор через ${cooldownSec} с` : "Получить код"}
                </button>
              </div>
            ) : (
              <div className="cabinet-auth-email-form">
                <p className="cabinet-auth-hint">
                  {deliveryMode === "log_only" ? (
                    <>
                      Запрос принят для <strong>{email.trim()}</strong>. Письмо и Telegram <strong>не использовались</strong> —
                      код только в логах сервера.
                    </>
                  ) : null}
                  {deliveryMode === "telegram" ? (
                    <>
                      Код отправлен в <strong>Telegram</strong> — откройте личные сообщения с ботом приложения.
                    </>
                  ) : null}
                  {deliveryMode === "telegram_smtp" ? (
                    <>
                      Код в <strong>Telegram</strong> и продублирован на <strong>{email.trim()}</strong>.
                    </>
                  ) : null}
                  {deliveryMode === "smtp" ? (
                    <>
                      Код отправлен на <strong>{email.trim()}</strong>.
                    </>
                  ) : null}
                </p>
                {deliveryMode === "log_only" ? (
                  <p className="cabinet-auth-notice cabinet-auth-notice--warn" role="status">
                    Настройте SMTP (<code className="cabinet-auth-code">SMTP_HOST</code>, <code className="cabinet-auth-code">SMTP_FROM</code> и учётные данные) или Resend (
                    <code className="cabinet-auth-code">RESEND_API_KEY</code>, <code className="cabinet-auth-code">RESEND_FROM</code>
                    ). Для отладки без почты можно <code className="cabinet-auth-code">EMAIL_OTP_TELEGRAM_FALLBACK=1</code> — иначе
                    код только в журнале сервера.
                  </p>
                ) : null}
                {deliveryMode === "telegram" || deliveryMode === "telegram_smtp" ? (
                  <p className="cabinet-auth-notice" role="status">
                    Не видите сообщения? Откройте диалог с ботом в Telegram и нажмите <strong>Старт</strong> (/start),
                    затем снова «Получить код».
                  </p>
                ) : null}
                {deliveryMode === "smtp" ? (
                  <p className="cabinet-auth-notice" role="status">
                    Если письма нет несколько минут — проверьте «Спам» и корректность адреса.
                  </p>
                ) : null}
                {deliveryMode === "telegram_smtp" ? (
                  <p className="cabinet-auth-notice" role="status">
                    Дубликат на почте может задержаться или попасть в «Спам».
                  </p>
                ) : null}
                <label className="cabinet-auth-field">
                  <span className="cabinet-auth-field__label">
                    {deliveryMode === "telegram"
                      ? "Код из Telegram"
                      : deliveryMode === "telegram_smtp"
                        ? "Код из Telegram или письма"
                        : deliveryMode === "smtp"
                          ? "Код из письма"
                          : "Код подтверждения"}
                  </span>
                  <input
                    type="text"
                    className="cabinet-auth-field__input cabinet-auth-field__input--code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={loadingVerify}
                  />
                </label>
                <button
                  type="button"
                  className="cabinet-auth-primary"
                  onClick={() => void handleVerify()}
                  disabled={loadingVerify || code.replace(/\D/g, "").length !== 6}
                >
                  {loadingVerify ? "Проверка…" : "Подтвердить"}
                </button>
                <button
                  type="button"
                  className="cabinet-auth-secondary"
                  onClick={() => void handleSendCode()}
                  disabled={loadingSend || loadingVerify || cooldownSec > 0}
                >
                  {cooldownSec > 0 ? `Отправить снова через ${cooldownSec} с` : "Отправить код снова"}
                </button>
                <button
                  type="button"
                  className="cabinet-auth-link"
                  onClick={() => {
                    setPhase("email");
                    setCode("");
                    setError(null);
                    setDeliveryMode(null);
                  }}
                >
                  Изменить email
                </button>
              </div>
            )}

            {error ? (
              <p className="cabinet-auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <p className="cabinet-auth-card__terms">
              Продолжая, вы соглашаетесь с{" "}
              <button type="button" className="cabinet-auth-card__terms-action" onClick={() => setLegalModal("terms")}>
                условиями использования
              </button>{" "}
              и{" "}
              <button type="button" className="cabinet-auth-card__terms-action" onClick={() => setLegalModal("privacy")}>
                политикой конфиденциальности
              </button>
            </p>
          </section>
          {legalModal ? (
            <div className="modal-overlay" onClick={() => setLegalModal(null)}>
              <div className="modal-box cabinet-auth-legal-modal" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="modal-close" onClick={() => setLegalModal(null)} aria-label="Закрыть">
                  ×
                </button>
                <p className="cabinet-auth-legal-modal__title">
                  {legalModal === "terms" ? "Условия использования" : "Политика конфиденциальности"}
                </p>
                <div className="cabinet-auth-legal-modal__content">
                  {legalModal === "terms" ? USER_AGREEMENT_TEXT : PRIVACY_AND_COOKIE_TEXT}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {!blocking ? <nav className="bottom-nav">
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
        </nav> : null}
      </div>
    </main>
  );
};

export default CabinetAuthScreen;
