# Supabase Classroom MVP

A beginner-friendly full-stack MVP inspired by Google Classroom.

## Tech
- Frontend: React + Vite + Tailwind
- Backend: Python Flask (REST API)
- Database/Auth/Storage: Supabase

## Run locally

### 1) Backend
Create a virtual environment (recommended), then install dependencies.

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Backend runs on `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Supabase setup
- Create a Supabase project and enable **Email/Password** auth.
- Create DB tables + RLS policies using the SQL in `supabase/schema.sql` (added next).
- Create Storage buckets:
  - `syllabi`
  - `submissions`

## Notes
- The frontend logs in using Supabase Auth directly.
- The backend expects `Authorization: Bearer <access_token>` for protected API calls.

