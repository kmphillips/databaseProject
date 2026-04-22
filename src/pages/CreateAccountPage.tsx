import { useState } from 'react'
import type { FormEvent } from 'react'

export function CreateAccountPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

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
    <section className="signup-page" aria-labelledby="create-account-title">
      <article className="signup-card">
        <div className="signup-copy">
          <p className="eyebrow">Chess app</p>
          <h2 id="create-account-title">Create your account</h2>
          <p className="lede">
            Set up your profile to save games, track matches, and keep your chess
            data in one place.
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
      </article>
    </section>
  )
}
