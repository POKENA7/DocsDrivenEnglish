-- 1. sessions テーブルを新設
CREATE TABLE `sessions` (
  `session_id`        TEXT NOT NULL PRIMARY KEY,
  `user_id`           TEXT NOT NULL,
  `topic`             TEXT NOT NULL,
  `mode`              TEXT NOT NULL,
  `question_ids_json` TEXT NOT NULL,
  `created_at`        INTEGER NOT NULL
);

-- 2. questions テーブルを再作成（session_id / source_question_id を削除、user_id / topic を追加）
CREATE TABLE `questions_new` (
  `question_id`   TEXT NOT NULL PRIMARY KEY,
  `user_id`       TEXT NOT NULL,
  `mode`          TEXT NOT NULL,
  `topic`         TEXT NOT NULL,
  `prompt`        TEXT NOT NULL,
  `choices_json`  TEXT NOT NULL,
  `correct_index` INTEGER NOT NULL,
  `explanation`   TEXT NOT NULL,
  `created_at`    INTEGER NOT NULL
);

-- 既存データの移行: study_sessions から topic / user_id を取得
-- source_question_id が NULL のもの（オリジナル問題）のみ移行
INSERT INTO `questions_new` (`question_id`, `user_id`, `mode`, `topic`, `prompt`, `choices_json`, `correct_index`, `explanation`, `created_at`)
SELECT q.`question_id`, COALESCE(s.`user_id`, ''), q.`mode`, s.`topic`, q.`prompt`, q.`choices_json`, q.`correct_index`, q.`explanation`, q.`created_at`
FROM `questions` q
INNER JOIN `study_sessions` s ON q.`session_id` = s.`session_id`
WHERE q.`source_question_id` IS NULL;

DROP TABLE `questions`;
ALTER TABLE `questions_new` RENAME TO `questions`;

-- 3. 旧テーブルを削除
DROP TABLE IF EXISTS `study_sessions`;