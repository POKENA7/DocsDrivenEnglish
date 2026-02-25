CREATE TABLE shared_questions (
  id                TEXT    PRIMARY KEY,
  topic             TEXT    NOT NULL,
  mode              TEXT    NOT NULL,
  prompt            TEXT    NOT NULL,
  choices_json      TEXT    NOT NULL,
  correct_index     INTEGER NOT NULL,
  explanation       TEXT    NOT NULL,
  created_by        TEXT,
  source_session_id TEXT,
  play_count        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL
);

CREATE INDEX idx_shared_questions_topic_mode
  ON shared_questions (topic, mode);
