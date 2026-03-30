-- Run these SQL commands in your Supabase/PostgreSQL database

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  grade INTEGER NOT NULL CHECK (grade IN (1, 2, 3, 4)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Curriculum notes table
CREATE TABLE IF NOT EXISTS curriculum_notes (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  week_start DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, week_start)
);

-- Weekly plans table
CREATE TABLE IF NOT EXISTS weekly_plans (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  week_start DATE NOT NULL,
  plan_md TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, week_start)
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  date DATE NOT NULL,
  time TIME,
  type VARCHAR(50) NOT NULL CHECK (type IN ('ferie', 'elevsamtale', 'foreldremøte')),
  title VARCHAR(255) NOT NULL,
  agenda TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  collection VARCHAR(255) NOT NULL,
  grade INTEGER NOT NULL CHECK (grade IN (1, 2, 3, 4)),
  language VARCHAR(50) DEFAULT 'norsk',
  tags JSONB DEFAULT '[]',
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_curriculum_notes_class_week ON curriculum_notes(class_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_class_week ON weekly_plans(class_id, week_start);
CREATE INDEX IF NOT EXISTS idx_calendar_events_class ON calendar_events(class_id);
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);
CREATE INDEX IF NOT EXISTS idx_documents_grade ON documents(grade);
