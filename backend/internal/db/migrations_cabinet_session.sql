-- Зеркало EnsureCabinetAuthSessionsTable (PostgreSQL).

CREATE TABLE IF NOT EXISTS cabinet_auth_sessions (
    id               BIGSERIAL PRIMARY KEY,
    token_hash       TEXT NOT NULL UNIQUE,
    user_id          BIGINT NOT NULL,
    email_normalized TEXT NOT NULL,
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cabinet_auth_sessions_user_id ON cabinet_auth_sessions (user_id);
