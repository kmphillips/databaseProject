import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useAuth } from '../App'

type UserProfile = {
  username: string
  createdAt: string
  rating: number
}

export function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!user) return

    fetch(`/api/users/${user.userId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load profile.')
        return res.json() as Promise<UserProfile>
      })
      .then((data) => setProfile(data))
      .catch(() => setError('Could not load profile data.'))
  }, [user])

  async function handleChangePassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const currentPassword = formData.get('currentPassword')?.toString() ?? ''
    const newPassword = formData.get('newPassword')?.toString() ?? ''
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

    if (newPassword === currentPassword) {
      setPwStatus({ type: 'error', message: 'New password is the same as old password.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', message: 'New passwords do not match.' })
      return
    }

    setPwSubmitting(true)
    setPwStatus(null)

    try {
      const res = await fetch(`/api/users/${user.userId}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const payload = (await res.json()) as { message?: string }

      if (!res.ok) throw new Error(payload.message ?? 'Failed to change password.')

      setPwStatus({ type: 'success', message: payload.message ?? 'Password updated successfully.' })
      form.reset()
      setShowPasswordForm(false)
    } catch (err) {
      setPwStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to change password.' })
    } finally {
      setPwSubmitting(false)
    }
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <section className="panel" aria-labelledby="profile-title">
      <div className="panel-header">
        <p className="eyebrow">Account</p>
        <h2 id="profile-title">Profile</h2>
      </div>

      {error && <p className="status-message error">{error}</p>}

      <article className="panel-card profile-grid">
        <div>
          <p className="stat-label">Username</p>
          <p className="profile-value">{profile?.username ?? '—'}</p>
        </div>
        <div>
          <p className="stat-label">Rating</p>
          <p className="profile-value">{profile?.rating ?? '—'}</p>
        </div>
        <div>
          <p className="stat-label">Member since</p>
          <p className="profile-value">{memberSince}</p>
        </div>
      </article>

      <article className="panel-card">
        <h3>Profile actions</h3>
        <ul className="simple-list">
          <li>
            <button
              type="button"
              className="link-action"
              onClick={() => { setShowPasswordForm((v) => !v); setPwStatus(null) }}
            >
              {showPasswordForm ? 'Cancel' : 'Change password'}
            </button>

            {showPasswordForm && (
              <form className="signup-form" style={{ marginTop: '16px' }} onSubmit={handleChangePassword}>
                <label>
                  Current password
                  <input type="password" name="currentPassword" placeholder="Enter current password" minLength={8} required />
                </label>
                <label>
                  New password
                  <input type="password" name="newPassword" placeholder="Enter new password" minLength={8} required />
                </label>
                <label>
                  Confirm new password
                  <input type="password" name="confirmPassword" placeholder="Repeat new password" minLength={8} required />
                </label>
                <button type="submit" className="primary-action" disabled={pwSubmitting}>
                  {pwSubmitting ? 'Saving...' : 'Save new password'}
                </button>
                {pwStatus && (
                  <p className={pwStatus.type === 'success' ? 'status-message success' : 'status-message error'} role="status" aria-live="polite">
                    {pwStatus.message}
                  </p>
                )}
              </form>
            )}
          </li>
        </ul>
      </article>
    </section>
  )
}
