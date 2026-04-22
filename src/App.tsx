import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './components/AppLayout'
import { CreateAccountPage } from './pages/CreateAccountPage'
import { DashboardPage } from './pages/DashboardPage'
import { GamePage } from './pages/GamePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create-account" element={<CreateAccountPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  )
}

export default App
