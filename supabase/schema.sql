-- CEED Question Bank schema. Applied by `pnpm db:init` via service role.
-- Idempotent: safe to run multiple times.

create extension if not exists "pgcrypto";

-- ============ exams ============
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  paper_identifier text,
  question_paper_path text,
  answer_key_path text,
  created_at timestamptz not null default now(),
  unique (year, paper_identifier)
);

alter table exams enable row level security;

drop policy if exists "public read exams" on exams;
create policy "public read exams" on exams
  for select using (true);

-- ============ questions ============
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  question_number integer not null,
  section text not null default 'A',
  sub_section text,
  question_type text not null,
  question_text text not null,
  raw_question_text text,
  raw_answer_text text,
  correct_answer_json jsonb,
  status text not null default 'needs_review',
  extraction_method text,
  extraction_confidence numeric,
  source_pdf text,
  source_pages integer[],
  source_bbox jsonb,
  is_dropped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, section, question_number)
);

create index if not exists questions_exam_section_status_idx
  on questions (exam_id, section, status);

alter table questions enable row level security;

drop policy if exists "public read questions" on questions;
create policy "authenticated read questions" on questions
  for select using (auth.role() = 'authenticated');

-- ============ question_options ============
create table if not exists question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  option_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, option_key)
);

alter table question_options enable row level security;

drop policy if exists "authenticated read options" on question_options;
create policy "authenticated read options" on question_options
  for select using (auth.role() = 'authenticated');

-- ============ question_images ============
create table if not exists question_images (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  image_index integer not null default 0,
  storage_path text not null,
  url text,
  source_page integer,
  bounding_box jsonb,
  created_at timestamptz not null default now(),
  unique (question_id, image_index)
);

alter table question_images enable row level security;

drop policy if exists "authenticated read images" on question_images;
create policy "authenticated read images" on question_images
  for select using (auth.role() = 'authenticated');

-- ============ profiles ============
-- Stores user-chosen display name; linked to Supabase auth users.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "auth manage own profile" on profiles;
create policy "auth manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public read own profile" on profiles;
create policy "public read own profile" on profiles
  for select using (auth.role() = 'authenticated');

-- ============ test sessions ============
create table if not exists test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_count integer not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table test_sessions enable row level security;

drop policy if exists "user own sessions" on test_sessions;
create policy "user own sessions" on test_sessions
  for all using (auth.uid() = user_id);

-- ============ test session questions ============
create table if not exists test_session_questions (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  question_order integer not null,
  unique (test_session_id, question_order)
);

alter table test_session_questions enable row level security;

drop policy if exists "session own questions" on test_session_questions;
create policy "session own questions" on test_session_questions
  for all using (auth.uid() = (
    select user_id from test_sessions where id = test_session_id limit 1
  ));

-- ============ test answers ============
create table if not exists test_answers (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_session_id, question_id)
);

alter table test_answers enable row level security;

drop policy if exists "session own answers" on test_answers;
create policy "session own answers" on test_answers
  for all using (auth.uid() = (
    select user_id from test_sessions where id = test_session_id limit 1
  ));

-- ============ battle rooms ============
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid references auth.users(id) on delete cascade,
  host_username text,
  question_count integer not null default 10,
  status text not null default 'waiting',
  question_ids uuid[],
  timer_seconds integer not null default 600,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

alter table rooms enable row level security;

drop policy if exists "public read rooms" on rooms;
create policy "public read rooms" on rooms
  for select using (true);

-- ============ room participants ============
create table if not exists room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  score integer default 0,
  answers jsonb,
  timings jsonb,
  completed boolean not null default false,
  current_index integer,
  time_remaining integer,
  marked_for_review jsonb,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table room_participants enable row level security;

drop policy if exists "public read participants" on room_participants;
create policy "public read participants" on room_participants
  for select using (true);

-- ============ migration (idempotent) ============
alter table test_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table test_sessions add column if not exists timer_seconds integer;
alter table test_sessions add column if not exists started_at timestamptz;
alter table test_answers add column if not exists time_spent_ms integer;
alter table room_participants add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table room_participants add column if not exists timings jsonb;
alter table room_participants add column if not exists completed boolean not null default false;
alter table room_participants add column if not exists current_index integer;
alter table room_participants add column if not exists time_remaining integer;
alter table room_participants add column if not exists marked_for_review jsonb;

-- ============ Row Level Security ============
-- Note: the service_role key bypasses RLS and is used by server-side scripts
-- (process-papers, db-init, API routes via the service role client).