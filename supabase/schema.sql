-- Supabase Classroom MVP schema + RLS policies
-- Run this in the Supabase SQL editor (in a fresh project).

-- Safety: keep everything in public schema for MVP
set search_path = public;

-- USERS
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null check (role in ('student', 'faculty')),
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

-- Helpful indexes (MVP)
create index if not exists idx_classrooms_faculty_id on public.classrooms(faculty_id);
create index if not exists idx_enrollments_student_id on public.enrollments(student_id);
create index if not exists idx_enrollments_classroom_id on public.enrollments(classroom_id);
create index if not exists idx_assignments_classroom_id on public.assignments(classroom_id);
create index if not exists idx_submissions_assignment_id on public.submissions(assignment_id);
create index if not exists idx_submissions_student_id on public.submissions(student_id);
create index if not exists idx_messages_classroom_id on public.messages(classroom_id);
create index if not exists idx_messages_timestamp on public.messages(timestamp);

-- =============
-- RLS POLICIES
-- =============

alter table public.users enable row level security;
alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.messages enable row level security;

-- USERS: each user can manage their own profile row
drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users for select
to authenticated
using (id = auth.uid());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users for insert
to authenticated
with check (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- CLASSROOMS: faculty owners can CRUD their classrooms
drop policy if exists classrooms_insert_faculty_owner on public.classrooms;
create policy classrooms_insert_faculty_owner
on public.classrooms for insert
to authenticated
with check (
  faculty_id = auth.uid()
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'faculty'
  )
);

drop policy if exists classrooms_select_members on public.classrooms;
create policy classrooms_select_members
on public.classrooms for select
to authenticated
using (
  faculty_id = auth.uid()
  or exists (
    select 1 from public.enrollments e
    where e.classroom_id = classrooms.id
      and e.student_id = auth.uid()
  )
);

drop policy if exists classrooms_update_faculty_owner on public.classrooms;
create policy classrooms_update_faculty_owner
on public.classrooms for update
to authenticated
using (faculty_id = auth.uid())
with check (faculty_id = auth.uid());

drop policy if exists classrooms_delete_faculty_owner on public.classrooms;
create policy classrooms_delete_faculty_owner
on public.classrooms for delete
to authenticated
using (faculty_id = auth.uid());

-- ENROLLMENTS
-- Students can join (insert) themselves into a classroom.
drop policy if exists enrollments_insert_student on public.enrollments;
create policy enrollments_insert_student
on public.enrollments for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'student'
  )
);

-- Students can view their own enrollments.
drop policy if exists enrollments_select_student on public.enrollments;
create policy enrollments_select_student
on public.enrollments for select
to authenticated
using (student_id = auth.uid());

-- Faculty can view enrollments for their classrooms.
drop policy if exists enrollments_select_faculty on public.enrollments;
create policy enrollments_select_faculty
on public.enrollments for select
to authenticated
using (
  exists (
    select 1 from public.classrooms c
    where c.id = enrollments.classroom_id
      and c.faculty_id = auth.uid()
  )
);

-- ASSIGNMENTS
drop policy if exists assignments_insert_faculty_owner on public.assignments;
create policy assignments_insert_faculty_owner
on public.assignments for insert
to authenticated
with check (
  exists (
    select 1 from public.classrooms c
    where c.id = assignments.classroom_id
      and c.faculty_id = auth.uid()
  )
);

drop policy if exists assignments_select_members on public.assignments;
create policy assignments_select_members
on public.assignments for select
to authenticated
using (
  exists (
    select 1 from public.classrooms c
    where c.id = assignments.classroom_id
      and (
        c.faculty_id = auth.uid()
        or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id
            and e.student_id = auth.uid()
        )
      )
  )
);

drop policy if exists assignments_update_faculty_owner on public.assignments;
create policy assignments_update_faculty_owner
on public.assignments for update
to authenticated
using (
  exists (
    select 1 from public.classrooms c
    where c.id = assignments.classroom_id
      and c.faculty_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.classrooms c
    where c.id = assignments.classroom_id
      and c.faculty_id = auth.uid()
  )
);

drop policy if exists assignments_delete_faculty_owner on public.assignments;
create policy assignments_delete_faculty_owner
on public.assignments for delete
to authenticated
using (
  exists (
    select 1 from public.classrooms c
    where c.id = assignments.classroom_id
      and c.faculty_id = auth.uid()
  )
);

-- SUBMISSIONS
drop policy if exists submissions_insert_student on public.submissions;
create policy submissions_insert_student
on public.submissions for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    join public.enrollments e on e.classroom_id = a.classroom_id
    where a.id = submissions.assignment_id
      and e.student_id = auth.uid()
  )
);

drop policy if exists submissions_update_student on public.submissions;
create policy submissions_update_student
on public.submissions for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists submissions_select_student on public.submissions;
create policy submissions_select_student
on public.submissions for select
to authenticated
using (student_id = auth.uid());

drop policy if exists submissions_select_faculty_owner on public.submissions;
create policy submissions_select_faculty_owner
on public.submissions for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    join public.classrooms c on c.id = a.classroom_id
    where a.id = submissions.assignment_id
      and c.faculty_id = auth.uid()
  )
);

-- MESSAGES (chat)
drop policy if exists messages_insert_members on public.messages;
create policy messages_insert_members
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.classrooms c
    where c.id = messages.classroom_id
      and (
        c.faculty_id = auth.uid()
        or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id and e.student_id = auth.uid()
        )
      )
  )
);

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.classrooms c
    where c.id = messages.classroom_id
      and (
        c.faculty_id = auth.uid()
        or exists (
          select 1 from public.enrollments e
          where e.classroom_id = c.id and e.student_id = auth.uid()
        )
      )
  )
);

-- Realtime (needed for chat): make sure messages table is in the realtime publication.
-- In the Supabase UI: Database -> Replication -> enable realtime for public.messages

