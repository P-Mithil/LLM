import { Link } from 'react-router-dom'

import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import type { Classroom } from './types'

export function ClassroomCard({ classroom }: { classroom: Classroom }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-14 -top-14 h-32 w-32 rounded-full bg-slate-100 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-900">
              {classroom.course_name}
            </div>
            <Badge variant="indigo">{classroom.course_code}</Badge>
          </div>
          {classroom.description ? (
            <div className="mt-2 line-clamp-2 text-sm text-slate-600">
              {classroom.description}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-400">No description</div>
          )}
          <div className="mt-3 text-xs text-slate-500">
            Class code: <span className="font-mono">{classroom.class_code}</span>
          </div>
        </div>

        <Link to={`/classrooms/${classroom.id}`}>
          <Button size="sm">Open</Button>
        </Link>
      </div>
    </Card>
  )
}

