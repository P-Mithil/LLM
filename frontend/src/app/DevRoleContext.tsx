import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

export type DevRole = 'student' | 'faculty'

type DevRoleState = {
  role: DevRole | null
  setRole: (role: DevRole | null) => void
}

const LS_KEY = 'classroom_mvp_dev_role'

const DevRoleContext = createContext<DevRoleState | null>(null)

export function DevRoleProvider({ children }: PropsWithChildren) {
  const [role, setRoleState] = useState<DevRole | null>(() => {
    const raw = localStorage.getItem(LS_KEY)
    return raw === 'student' || raw === 'faculty' ? raw : null
  })

  function setRole(next: DevRole | null) {
    if (!next) localStorage.removeItem(LS_KEY)
    else localStorage.setItem(LS_KEY, next)
    setRoleState(next)
  }

  const value = useMemo(() => ({ role, setRole }), [role])
  return <DevRoleContext.Provider value={value}>{children}</DevRoleContext.Provider>
}

export function useDevRole() {
  const ctx = useContext(DevRoleContext)
  if (!ctx) throw new Error('useDevRole must be used inside DevRoleProvider')
  return ctx
}

