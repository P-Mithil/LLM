import { Link } from 'react-router-dom'

import { Button } from '../components/Button'
import { Card } from '../components/Card'

export function LandingPage() {
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="absolute -top-24 right-[-120px] h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />
        <div className="absolute -bottom-24 left-[-120px] h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl" />

        <div className="relative grid gap-8 p-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Classroom MVP
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                Supabase + Flask
              </span>
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Teach, learn, and submit — in one place.
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              A clean, beginner-friendly Google Classroom-style app: faculty create classes and
              assignments, students join via a unique code and submit work, and everyone can chat.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button className="w-full">Login</Button>
              </Link>
              <Link to="/auth?mode=signup" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <Card className="bg-gradient-to-br from-slate-50 to-white">
              <div className="text-sm font-semibold text-slate-900">Create classrooms</div>
              <div className="mt-1 text-sm text-slate-600">
                Faculty can add course details and a syllabus, and share an auto-generated class
                code.
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-white">
              <div className="text-sm font-semibold text-slate-900">Join by code</div>
              <div className="mt-1 text-sm text-slate-600">
                Students join instantly using a unique class code — just like Classroom.
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-white">
              <div className="text-sm font-semibold text-slate-900">Assignments + chat</div>
              <div className="mt-1 text-sm text-slate-600">
                Post assignments, submit files, and ask doubts in realtime chat.
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <div>Minimal UI. Clean UX. Beginner-friendly code.</div>
        <a
          href="https://supabase.com"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
        >
          Powered by Supabase
        </a>
      </div>
    </div>
  )
}

