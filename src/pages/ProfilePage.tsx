import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useAuth } from '../App'
import { GameReplayViewer } from '../features/chess/components/GameReplayViewer'
import { getGameMoves, getUserGameHistory } from '../features/chess/services/chessApi'
import type { PersistedMove, UserFinishedGame } from '../features/chess/types'

type UserProfile = {
  username: string
  createdAt: string
  rating: number
  favoriteOpenings: string[]
}

function formatOutcome(result: string | null, yourColor: 'white' | 'black'): string {
  if (result === 'draw') {
    return 'Draw'
  }
  if (result === 'white' || result === 'black') {
    return result === yourColor ? 'Win' : 'Loss'
  }
  return '—'
}

function colorLabel(color: 'white' | 'black'): string {
  return color === 'white' ? 'White' : 'Black'
}

export function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const [gameHistory, setGameHistory] = useState<UserFinishedGame[]>([])
  const [historyError, setHistoryError] = useState('')
  const [selectedHistoryGame, setSelectedHistoryGame] = useState<UserFinishedGame | null>(null)
  const [replayMoves, setReplayMoves] = useState<PersistedMove[]>([])
  const [replayLoading, setReplayLoading] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [showFavoriteOpenings, setShowFavoriteOpenings] = useState(false)

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

  useEffect(() => {
    if (!user) {
      return
    }

    void (async () => {
      try {
        const payload = await getUserGameHistory(user.userId)
        setGameHistory(payload.games)
        setHistoryError('')
      } catch (err) {
        setHistoryError(err instanceof Error ? err.message : 'Could not load game history.')
      }
    })()
  }, [user])

  useEffect(() => {
    if (!selectedHistoryGame) {
      setReplayMoves([])
      return
    }

    void (async () => {
      setReplayLoading(true)
      try {
        const payload = await getGameMoves(selectedHistoryGame.game_id)
        setReplayMoves(payload.moves)
      } catch {
        setReplayMoves([])
      } finally {
        setReplayLoading(false)
      }
    })()
  }, [selectedHistoryGame])

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

  async function handleEditOpenings(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const openingInput = formData.get('openingInput')?.toString() ?? ''
    const favoriteOpening = openingInput.trim()
    const action = formData.get('action')?.toString()
    //console.log('handleEditOpenings', { favoriteOpening, action })
      if (action === 'add') {
        if (favoriteOpening.length === 0) {
          setError('Please enter an opening name to add.')
          return
        }
        if (profile?.favoriteOpenings.includes(favoriteOpening)) {
          setError('This opening is already in your favorites.')
          return
        }
        try {
          const res = await fetch(`/api/users/${user?.userId}/addFavoriteOpening`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openingName: favoriteOpening }),
          })
        } catch (err) {
          setError('Failed to add favorite opening.')
        }
      }
      if (action === 'remove') {
        if (favoriteOpening.length === 0) {
          setError('Please enter an opening name to remove.')
          return
        }
        if (!profile?.favoriteOpenings.includes(favoriteOpening)) {
          setError('This opening is not in your favorites.')
          return
        }
        try {          
            const res = await fetch(`/api/users/${user?.userId}/deleteFavoriteOpening`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openingName: favoriteOpening }),
          })
        }
         catch (err) {
          setError('Failed to remove favorite opening.')
        }
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
        <div>
          <p className="stat-label">Favorite Openings</p>
          <p className="profile-value">{profile?.favoriteOpenings.join(', ') ?? '—'}</p>
        </div>
      </article>

      <article className="panel-card">
        <h3>Game history</h3>
        <p className="fine-print" style={{ marginBottom: '12px' }}>
          Completed games on this site. Select a row to replay moves on the board.
        </p>
        {historyError && <p className="status-message error">{historyError}</p>}
        {!historyError && gameHistory.length === 0 && (
          <p className="fine-print">No finished games yet.</p>
        )}
        {gameHistory.length > 0 && (
          <div className="profile-history-layout">
            <div className="history-table-wrap">
              <table className="game-history-table">
                <caption className="sr-only">Your completed games</caption>
                <thead>
                  <tr>
                    <th scope="col">Game</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">You</th>
                    <th scope="col">Result</th>
                    <th scope="col">Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {gameHistory.map((row) => {
                    const selected = selectedHistoryGame?.game_id === row.game_id
                    function toggleRow() {
                      setSelectedHistoryGame((current) =>
                        current?.game_id === row.game_id ? null : row,
                      )
                    }
                    return (
                      <tr
                        key={row.game_id}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selected}
                        aria-label={`Game ${row.game_id}, opponent ${row.opponent_username}, ${formatOutcome(row.result, row.your_color)}`}
                        className={selected ? 'game-history-row game-history-row-selected' : 'game-history-row'}
                        onClick={toggleRow}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            toggleRow()
                          }
                        }}
                      >
                        <td>
                          <span className="game-history-id">#{row.game_id}</span>
                        </td>
                        <td>{row.opponent_username}</td>
                        <td>{colorLabel(row.your_color)}</td>
                        <td>{formatOutcome(row.result, row.your_color)}</td>
                        <td>{row.time_control ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selectedHistoryGame && (
              <div className="panel-card profile-replay-card">
                <div className="profile-replay-header">
                  <h4>
                    Game #{selectedHistoryGame.game_id} vs {selectedHistoryGame.opponent_username}
                  </h4>
                  <button
                    type="button"
                    className="link-action"
                    onClick={() => setSelectedHistoryGame(null)}
                  >
                    Close
                  </button>
                </div>
                <p className="fine-print">
                  You played {colorLabel(selectedHistoryGame.your_color)} —{' '}
                  {formatOutcome(selectedHistoryGame.result, selectedHistoryGame.your_color)}
                </p>
                {replayLoading ? (
                  <p className="fine-print">Loading moves…</p>
                ) : user ? (
                  <GameReplayViewer
                    moves={replayMoves}
                    whiteLabel={
                      selectedHistoryGame.your_color === 'white'
                        ? user.username
                        : selectedHistoryGame.opponent_username
                    }
                    blackLabel={
                      selectedHistoryGame.your_color === 'black'
                        ? user.username
                        : selectedHistoryGame.opponent_username
                    }
                    boardOrientation={selectedHistoryGame.your_color}
                  />
                ) : null}
              </div>
            )}
          </div>
        )}
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
          <li>
            <button
              type="button"
              className="link-action"
              onClick={() => { setShowFavoriteOpenings((v) => !v)  }}
            >
              {showFavoriteOpenings ? 'Cancel' : 'Edit favorite openings'}
            </button>
            {showFavoriteOpenings && (
              <form className="signup-form" style={{ marginTop: '16px' }} onSubmit={handleEditOpenings}>
                <label>
                  Opening
                  <input type="text" name="openingInput" placeholder="Enter favorite opening" required />
                </label>
                <label>
                  Action
                  <select name="action" required>
                    <option value="">Select action</option>
                    <option value="add">Add to favorites</option>
                    <option value="remove">Remove from favorites</option>
                  </select>
                </label>
                <button type="submit" className="primary-action">
                  Submit
                </button>
                
              </form>
            )}

          </li>
        </ul>
      </article>
    </section>
  )
}
