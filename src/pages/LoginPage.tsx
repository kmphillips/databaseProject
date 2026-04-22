import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const username = formData.get('username')?.toString().trim() ?? ''
    const password = formData.get('password')?.toString() ?? ''

    setIsSubmitting(true)
    setStatusMessage('')
    setStatusType('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const payload = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(payload.message ?? 'Unable to log in.')
      }

      setStatusType('success')
      setStatusMessage(payload.message ?? 'Login successful.')
    } catch (error) {
      setStatusType('error')
      setStatusMessage(error instanceof Error ? error.message : 'Unable to log in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="signup-page" aria-labelledby="login-title">
      <article className="signup-card">
        <div className="signup-copy">
          <p className="eyebrow">Chess app</p>
          <h2 id="login-title">Welcome back</h2>
          <p className="lede">
            Log in to continue your matches, review openings, and track progress.
          </p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input type="text" name="username" placeholder="queenGambit" required />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              minLength={8}
              required
            />
          </label>

          <button type="submit" className="primary-action" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>

          {statusMessage && (
            <p
              className={
                statusType === 'success' ? 'status-message success' : 'status-message error'
              }
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          )}

          <Link className="secondary-action" to="/create-account">
            Create account
          </Link>
        </form>
      </article>
    </section>
  )
}
