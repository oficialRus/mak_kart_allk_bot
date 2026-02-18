CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    telegram_id BIGINT      NOT NULL UNIQUE,
    username    VARCHAR(255),
    full_name   VARCHAR(255),
    level       VARCHAR(50)  NOT NULL DEFAULT 'beginner',
    quiz_answers JSONB,
    quiz_skipped BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);
