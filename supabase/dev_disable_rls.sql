-- DEV MODE ONLY
-- Disables Row Level Security so the app can run without Supabase Auth.
-- Run this in Supabase SQL editor ONLY for local/dev testing.
--
-- IMPORTANT: Re-enable RLS before production.

alter table public.users disable row level security;
alter table public.classrooms disable row level security;
alter table public.enrollments disable row level security;
alter table public.assignments disable row level security;
alter table public.submissions disable row level security;
alter table public.messages disable row level security;

