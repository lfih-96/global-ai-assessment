import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { assessment, questions } from './questions.js';

const dbPath = resolve(process.env.DB_PATH || './data/global-ai.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student'
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, level TEXT NOT NULL,
  description TEXT NOT NULL, minutes INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, assessment_id INTEGER NOT NULL REFERENCES assessments(id),
  position INTEGER NOT NULL, type TEXT NOT NULL, skill TEXT NOT NULL, level TEXT NOT NULL,
  prompt TEXT NOT NULL, options_json TEXT, passage TEXT, correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  assessment_id INTEGER NOT NULL REFERENCES assessments(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  score_percent INTEGER NOT NULL, correct_count INTEGER NOT NULL, incorrect_count INTEGER NOT NULL,
  skills_json TEXT NOT NULL, feedback TEXT NOT NULL, interpretation TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id), response TEXT NOT NULL,
  is_correct INTEGER NOT NULL, PRIMARY KEY (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS attempts_user_date ON attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
`);

function hashPassword(password, salt) { return scryptSync(password, salt, 64).toString('hex'); }
const demoEmail = 'estudiante@globalai.demo';
const demoName = 'Fernando Ilbay';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail)) {
  const salt = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users (name,email,password_salt,password_hash) VALUES (?,?,?,?)')
    .run(demoName, demoEmail, salt, hashPassword('GlobalAI2026!', salt));
}
// Keep the existing demo account and its progress; only refresh its display name.
db.prepare('UPDATE users SET name = ? WHERE email = ? AND name <> ?')
  .run(demoName, demoEmail, demoName);
db.prepare('INSERT OR IGNORE INTO assessments (code,title,level,description,minutes) VALUES (?,?,?,?,?)')
  .run(assessment.code, assessment.title, assessment.level, assessment.description, assessment.minutes);
const assessmentId = db.prepare('SELECT id FROM assessments WHERE code = ?').get(assessment.code).id;
const insertQuestion = db.prepare(`INSERT OR IGNORE INTO questions
  (id,assessment_id,position,type,skill,level,prompt,options_json,passage,correct_answer,explanation)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
questions.forEach((q, index) => insertQuestion.run(q.id, assessmentId, index + 1, q.type,
  q.skill, q.level, q.prompt, q.options ? JSON.stringify(q.options) : null,
  q.passage || null, q.correct, q.explanation));

export function verifyPassword(password, user) {
  const actual = Buffer.from(hashPassword(password, user.password_salt), 'hex');
  const expected = Buffer.from(user.password_hash, 'hex');
  return actual.length === expected.length && (awaitSafeEqual(actual, expected));
}
import { timingSafeEqual } from 'node:crypto';
function awaitSafeEqual(a, b) { return timingSafeEqual(a, b); }

// Additive migration: existing results and sessions are preserved.
db.exec(`
CREATE TABLE IF NOT EXISTS expeditions (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 assessment_id INTEGER NOT NULL REFERENCES assessments(id),
 result_id INTEGER REFERENCES attempts(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_expedition ON expeditions(user_id) WHERE result_id IS NULL;
CREATE TABLE IF NOT EXISTS expedition_answers (
 expedition_id INTEGER NOT NULL REFERENCES expeditions(id),
 question_id TEXT NOT NULL REFERENCES questions(id), response TEXT NOT NULL,
 feedback_json TEXT NOT NULL, PRIMARY KEY(expedition_id,question_id)
);
`);

// Reward ledger: immutable events, one badge of each kind per student.
db.exec(`
CREATE TABLE IF NOT EXISTS reward_events (
 expedition_id INTEGER NOT NULL REFERENCES expeditions(id), event TEXT NOT NULL,
 xp INTEGER NOT NULL CHECK(xp >= 0), PRIMARY KEY(expedition_id,event)
);
CREATE TABLE IF NOT EXISTS earned_badges (
 user_id INTEGER NOT NULL REFERENCES users(id), code TEXT NOT NULL,
 expedition_id INTEGER NOT NULL REFERENCES expeditions(id),
 PRIMARY KEY(user_id,code)
);
`);
