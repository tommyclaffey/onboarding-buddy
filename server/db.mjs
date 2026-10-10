// SQLite via node:sqlite. Migrations are keyed on PRAGMA user_version. See SPEC §2.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS = [
  `
  CREATE TABLE orgs(id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, created_at TEXT);
  CREATE TABLE users(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, email TEXT UNIQUE COLLATE NOCASE NOT NULL,
    name TEXT NOT NULL, title TEXT, team TEXT, photo TEXT,
    role TEXT NOT NULL CHECK(role IN ('hire','admin','member')),
    duty TEXT, start_date TEXT, manager_id INT, buddy_id INT, journey_id INT,
    quote TEXT, ask_about TEXT, password_hash TEXT, created_at TEXT, last_seen_at TEXT);
  CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id INT NOT NULL, created_at TEXT, expires_at TEXT);
  CREATE TABLE journeys(id INTEGER PRIMARY KEY, org_id INT NOT NULL, name TEXT NOT NULL, edited_by INT, edited_at TEXT);
  CREATE TABLE stages(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, journey_id INT NOT NULL, position INT NOT NULL,
    name TEXT NOT NULL, emoji TEXT, tint TEXT, window TEXT, summary TEXT, start_day INT, end_day INT,
    intro_video_id INT);
  CREATE TABLE task_templates(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, stage_id INT NOT NULL, position INT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('form','sign','video','app','todo','meeting','it')),
    title TEXT NOT NULL, meta TEXT, emoji TEXT,
    owner_role TEXT NOT NULL CHECK(owner_role IN ('hire','people_ops','it','manager','buddy')),
    due_day INT NOT NULL DEFAULT 0, ref TEXT);
  CREATE TABLE hire_tasks(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, hire_id INT NOT NULL, template_id INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','done')), done_at TEXT, done_by INT, data TEXT,
    UNIQUE(hire_id, template_id));
  CREATE TABLE videos(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('intro','app','hello','lesson')),
    title TEXT NOT NULL, presenter_id INT, duration_sec INT, status TEXT NOT NULL DEFAULT 'published'
      CHECK(status IN ('published','needs_update','missing')),
    still TEXT, chapters TEXT, caption TEXT, app_key TEXT, position INT DEFAULT 0, flagged INT DEFAULT 0,
    created_at TEXT);
  CREATE TABLE quiz_questions(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, video_id INT NOT NULL, position INT,
    prompt TEXT NOT NULL, options TEXT NOT NULL, correct_index INT NOT NULL, explanation TEXT, wrong_hint TEXT);
  CREATE TABLE connected_apps(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, app_key TEXT NOT NULL, stage_id INT, roles TEXT,
    try_items TEXT, house_rules TEXT, owner_id INT, connected_by INT, connected_at TEXT,
    UNIQUE(org_id, app_key));
  CREATE TABLE signatures(hire_id INT NOT NULL, org_id INT NOT NULL, doc_key TEXT NOT NULL, typed_name TEXT, signed_at TEXT,
    PRIMARY KEY(hire_id, doc_key));
  CREATE TABLE form_answers(hire_id INT NOT NULL, org_id INT NOT NULL, form_key TEXT NOT NULL, step INT DEFAULT 1,
    answers TEXT, submitted_at TEXT, updated_at TEXT, PRIMARY KEY(hire_id, form_key));
  CREATE TABLE messages(
    id INTEGER PRIMARY KEY, org_id INT NOT NULL, user_id INT NOT NULL, from_id INT, kind TEXT,
    title TEXT NOT NULL, body TEXT, link TEXT, needs_action INT DEFAULT 0, created_at TEXT, read_at TEXT);
  CREATE TABLE feelings(id INTEGER PRIMARY KEY, org_id INT NOT NULL, hire_id INT NOT NULL, value INT NOT NULL, created_at TEXT);

  CREATE INDEX users_org ON users(org_id);
  CREATE INDEX stages_journey ON stages(org_id, journey_id, position);
  CREATE INDEX tt_stage ON task_templates(org_id, stage_id, position);
  CREATE INDEX ht_hire ON hire_tasks(org_id, hire_id);
  CREATE INDEX videos_org ON videos(org_id, kind);
  CREATE INDEX msg_user ON messages(org_id, user_id, created_at);
  `,
  // v2 (Oct 10): real video links (YouTube, Loom, Vimeo), stored as the embeddable URL.
  `ALTER TABLE videos ADD COLUMN url TEXT;`,
];

export const now = () => new Date().toISOString();

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

export const defaultDbPath = () => path.resolve(process.env.DATA_DIR || 'data', 'onboarding-buddy.db');

/** Run fn inside a transaction. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const json = (s, fallback = null) => {
  if (s == null || s === '') return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};
