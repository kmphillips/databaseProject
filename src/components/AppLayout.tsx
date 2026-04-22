import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/login', label: 'Login' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/game', label: 'Game' },
  { to: '/profile', label: 'Profile' },
  { to: '/create-account', label: 'Create account' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Chess app</p>
          <h1>Control Center</h1>
        </div>

        <nav aria-label="Primary navigation" className="top-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}
