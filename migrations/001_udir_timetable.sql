-- migrations/001_udir_timetable.sql
--
-- NOTE: This migration drops and recreates the udir_* and timetable_entries tables.
-- Safe to re-run on a fresh database; will lose any existing data in these tables.
-- Run AFTER DATABASE_SETUP.sql (requires the `classes` table to already exist).

-- Drop in reverse dependency order so FK constraints don't block the drops
DROP TABLE IF EXISTS udir_school_metric  CASCADE;
DROP TABLE IF EXISTS udir_school         CASCADE;
DROP TABLE IF EXISTS timetable_entries   CASCADE;

-- ── UDIR school registry ──────────────────────────────────────────────────────
CREATE TABLE udir_school (
  id            SERIAL PRIMARY KEY,
  nsr_id        TEXT UNIQUE NOT NULL,
  navn          TEXT NOT NULL,
  kommunenummer TEXT NOT NULL DEFAULT '0301',
  trinn_fra     INTEGER,
  trinn_til     INTEGER,
  raw           JSONB,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── UDIR school metrics (one row per school × year × eksport_id × indicator) ─
CREATE TABLE udir_school_metric (
  id              SERIAL PRIMARY KEY,
  nsr_id          TEXT NOT NULL REFERENCES udir_school(nsr_id) ON DELETE CASCADE,
  aar             INTEGER NOT NULL,
  trinn           TEXT NOT NULL,
  eksport_id      INTEGER NOT NULL,
  indikator_navn  TEXT NOT NULL,
  verdi           REAL,
  er_skjermet     BOOLEAN NOT NULL DEFAULT FALSE,
  direction       TEXT NOT NULL DEFAULT 'higher_is_better',
  raw             JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nsr_id, aar, trinn, eksport_id, indikator_navn)
);

-- ── Timetable entries ─────────────────────────────────────────────────────────
-- class_id intentionally has no FK to `classes` — Supabase may expose `classes`
-- as a view rather than a base table, and PostgreSQL forbids FK references to views.
-- The relationship is enforced at the application layer instead.
CREATE TABLE timetable_entries (
  id          SERIAL PRIMARY KEY,
  class_id    INTEGER NOT NULL,
  week_start  DATE NOT NULL,
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 5),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  subject     TEXT NOT NULL,
  title       TEXT,
  room        TEXT,
  notes       TEXT,
  color       TEXT DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_udir_school_metric_nsr   ON udir_school_metric(nsr_id);
CREATE INDEX idx_udir_school_metric_aar   ON udir_school_metric(aar);
CREATE INDEX idx_timetable_class_week     ON timetable_entries(class_id, week_start);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enabling RLS with no permissive policies blocks all access via the Supabase
-- Data API (PostgREST / anon key). The server-side postgres connection
-- (DATABASE_URL, runs as database owner) bypasses RLS and is unaffected.
ALTER TABLE udir_school         ENABLE ROW LEVEL SECURITY;
ALTER TABLE udir_school_metric  ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries   ENABLE ROW LEVEL SECURITY;
