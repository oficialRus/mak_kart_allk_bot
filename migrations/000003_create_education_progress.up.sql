CREATE TABLE IF NOT EXISTS education_progress (
    id                 SERIAL PRIMARY KEY,
    user_id            INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id          VARCHAR(100) NOT NULL,
    completed_lessons  JSONB       NOT NULL DEFAULT '[]',
    updated_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);
