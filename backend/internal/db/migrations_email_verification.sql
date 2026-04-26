-- Зеркало схемы из EnsureEmailVerificationTables (PostgreSQL).
-- Удобно для ручного применения или внешних миграторов.

ALTER TABLE mini_app_profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE mini_app_profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS email_verifications (
    id               BIGSERIAL PRIMARY KEY,
    telegram_id      BIGINT NOT NULL,
    email            TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    code_hash        TEXT NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL,
    attempts         INT NOT NULL DEFAULT 0,
    max_attempts     INT NOT NULL DEFAULT 5,
    last_sent_at     TIMESTAMPTZ NOT NULL,
    verified_at      TIMESTAMPTZ NULL,
    invalidated_at   TIMESTAMPTZ NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verifications_tg_pending
    ON email_verifications (telegram_id) WHERE verified_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS email_verifications_norm_created
    ON email_verifications (email_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS email_verifications_tg_created
    ON email_verifications (telegram_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS mini_app_profiles_one_verified_email
    ON mini_app_profiles (lower(trim(email)))
    WHERE email_verified_at IS NOT NULL AND trim(email) <> '';
