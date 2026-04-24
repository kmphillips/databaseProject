const SESSION_STORAGE_KEY = 'chess-app-session'

export type SessionUser = {
  userId: number
  username: string
}

export function getSessionUser(): SessionUser | null {
  const rawValue = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as SessionUser
    if (!parsedValue?.userId || !parsedValue?.username) {
      return null
    }
    return parsedValue
  } catch {
    return null
  }
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
}

export function clearSessionUser() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
