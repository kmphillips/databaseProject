import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './components/AppLayout'
import { CreateAccountPage } from './pages/CreateAccountPage'
import { DashboardPage } from './pages/DashboardPage'
import { GamePage } from './pages/GamePage'
import { LoginPage } from './pages/LoginPage'
import { FriendsPage } from './pages/FriendsPage'
import { ProfilePage } from './pages/ProfilePage'
import { getSessionUser, setSessionUser, clearSessionUser } from './features/auth/session'
import type { SessionUser } from './features/auth/session'

type AuthContextType = {
  user: SessionUser | null
  login: (user: SessionUser) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/game" replace />
  return <>{children}</>
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(getSessionUser)

  function login(u: SessionUser) {
    setSessionUser(u)
    setUser(u)
  }

  function logout() {
    clearSessionUser()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={user ? '/game' : '/login'} replace />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/create-account" element={<GuestRoute><CreateAccountPage /></GuestRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={user ? '/game' : '/login'} replace />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
  )
}

export default App
