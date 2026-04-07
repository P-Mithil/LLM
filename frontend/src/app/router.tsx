import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from './AppShell'
import { ClassroomPage } from '../pages/ClassroomPage'
import { FacultyDashboard } from '../pages/FacultyDashboard'
import { LandingPage } from '../pages/LandingPage'
import { AuthPage } from '../pages/AuthPage'
import { StudentDashboard } from '../pages/StudentDashboard'
import { RoleGate } from './roleGate'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/auth', element: <AuthPage /> },
      {
        path: '/student',
        element: (
          <RoleGate role="student">
            <StudentDashboard />
          </RoleGate>
        ),
      },
      {
        path: '/faculty',
        element: (
          <RoleGate role="faculty">
            <FacultyDashboard />
          </RoleGate>
        ),
      },
      {
        path: '/classrooms/:id',
        element: (
          <RoleGate role="any">
            <ClassroomPage />
          </RoleGate>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

