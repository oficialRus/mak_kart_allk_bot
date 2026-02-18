CREATE TABLE IF NOT EXISTS orders (
    id         SERIAL PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    items      JSONB         NOT NULL DEFAULT '[]',
    total      NUMERIC(10,2) NOT NULL DEFAULT 0,
    status     VARCHAR(50)   NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);
