import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {user && (
        <header className="top-bar">
          <div className="brand-block">
            <p className="eyebrow">Chess app</p>
            <h1>Control Center</h1>
          </div>

          <nav aria-label="Primary navigation" className="top-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/game"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              Game
            </NavLink>
            <NavLink
              to="/historical-games"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              Historical games
            </NavLink>
            <NavLink
              to="/pgn-upload"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              PGN upload
            </NavLink>
            <NavLink
              to="/friends"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              Friends
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
            >
              Profile
            </NavLink>
          </nav>

          <button className="nav-link logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </header>
      )}

      <main className={user ? 'page-content' : 'page-content page-content-auth'}>
        <Outlet />
      </main>
    </div>
  )
}
