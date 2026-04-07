-- Supabase Classroom MVP (Password auth via Flask; NO Supabase Auth)
-- Run this in Supabase SQL editor in a NEW project (recommended).

set search_path = public;

create extension if not exists pgcrypto;

-- USERS (app-owned)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null check (role in ('student', 'faculty')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- CLASSROOMS
create table if not exists public.classrooms (
  id bigint generated always as identity primary key,
  course_name text not null,
  course_code text not null,
  description text,
  syllabus_url text,
  faculty_id uuid not null references public.users(id),
  class_code text not null unique,
  created_at timestamptz not null default now()
);

-- ENROLLMENTS
create table if not exists public.enrollments (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.users(id),
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, classroom_id)
);

-- ASSIGNMENTS
create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  title text not null,
  description text,
  deadline timestamptz,
  file_url text,
  created_at timestamptz not null default now()
);

-- SUBMISSIONS
create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.users(id),
  file_url text not null,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- MESSAGES (chat)
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  classroom_id bigint not null references public.classrooms(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  message text not null,
  timestamp timestamptz not null default now()
);

-- Indexes
create index if not exists idx_classrooms_faculty_id on public.classrooms(faculty_id);
create index if not exists idx_enrollments_student_id on public.enrollments(student_id);
create index if not exists idx_enrollments_classroom_id on public.enrollments(classroom_id);
create index if not exists idx_assignments_classroom_id on public.assignments(classroom_id);
create index if not exists idx_submissions_assignment_id on public.submissions(assignment_id);
create index if not exists idx_messages_classroom_id on public.messages(classroom_id);

-- IMPORTANT for this auth approach:
-- RLS should be DISABLED and authorization enforced in Flask.
alter table public.users disable row level security;
alter table public.classrooms disable row level security;
alter table public.enrollments disable row level security;
alter table public.assignments disable row level security;
alter table public.submissions disable row level security;
alter table public.messages disable row level security;

