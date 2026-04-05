import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

function App() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const fullName = formData.get('fullName')?.toString().trim() ?? ''
    const email = formData.get('email')?.toString().trim() ?? ''
    const username = formData.get('username')?.toString().trim() ?? ''
    const password = formData.get('password')?.toString() ?? ''
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

    if (password !== confirmPassword) {
      setStatusType('error')
      setStatusMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setStatusMessage('')
    setStatusType('')

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          username,
          password,
        }),
      })

      const payload = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(payload.message ?? 'Unable to create account.')
      }

      setStatusType('success')
      setStatusMessage(payload.message ?? 'Account created successfully.')
      form.reset()
    } catch (error) {
      setStatusType('error')
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to create account.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-card" aria-labelledby="create-account-title">
        <div className="signup-copy">
          <p className="eyebrow">Chess app</p>
          <h1 id="create-account-title">Create your account</h1>
          <p className="lede">
            Set up your profile to save games, track matches, and keep your chess
            data in one place.
          </p>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input type="text" name="fullName" placeholder="Alex Carter" required />
          </label>

          <label>
            Email address
            <input
              type="email"
              name="email"
              placeholder="alex@example.com"
              required
            />
          </label>

          <label>
            Username
            <input type="text" name="username" placeholder="queenGambit" required />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="Create a password"
              minLength={8}
              required
            />
          </label>

          <label>
            Confirm password
            <input
              type="password"
              name="confirmPassword"
              placeholder="Repeat your password"
              minLength={8}
              required
            />
          </label>

          <button type="submit" className="primary-action" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
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

          <p className="fine-print">
            By creating an account, you agree to store your chess progress and
            profile details.
          </p>
        </form>
      </section>
    </main>
  )
}

export default App
