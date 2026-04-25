import { useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useAuth } from '../App'
import { GameReplayViewer } from '../features/chess/components/GameReplayViewer'
import { getGameMoves, getUserGameHistory } from '../features/chess/services/chessApi'
import type { PersistedMove, UserFinishedGame } from '../features/chess/types'
import { apiUrl } from '../config/api'

type UserProfile = {
  username: string
  createdAt: string
  rating: number
  favoriteOpenings: string[]
  awards: {
    award_name: string
    description: string
  }[]
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
  const { user, login } = useAuth()
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
  const [showUsernameForm, setShowUsernameForm] = useState(false)
  const [usernameSubmitting, setUsernameSubmitting] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [showFavoriteOpenings, setShowFavoriteOpenings] = useState(false)
  const [openingsSubmitting, setOpeningsSubmitting] = useState(false)
  const [openingsStatus, setOpeningsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [historySort, setHistorySort] = useState<'newest' | 'oldest'>('newest')
  const [historyColorFilter, setHistoryColorFilter] = useState<'all' | 'white' | 'black'>('all')
  const [historyResultFilter, setHistoryResultFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all')

  async function refreshProfile(userId: number) {
    const res = await fetch(apiUrl(`/api/users/${userId}`))
    if (!res.ok) {
      throw new Error('Failed to load profile.')
    }
    const data = (await res.json()) as UserProfile
    setProfile(data)
    setError('')
  }

  useEffect(() => {
    if (!user) return

    void refreshProfile(user.userId).catch(() => {
      setError('Could not load profile data.')
    })
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
      const res = await fetch(apiUrl(`/api/users/${user.userId}/change-password`), {
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
    setOpeningsStatus(null)
    setError('')

    if (action !== 'add' && action !== 'remove') {
      setOpeningsStatus({ type: 'error', message: 'Choose whether to add or remove.' })
      return
    }
    if (favoriteOpening.length === 0) {
      setOpeningsStatus({
        type: 'error',
        message: action === 'add'
          ? 'Please enter an opening name to add.'
          : 'Please enter an opening name to remove.',
      })
      return
    }
    if (action === 'add' && profile?.favoriteOpenings.includes(favoriteOpening)) {
      setOpeningsStatus({ type: 'error', message: 'This opening is already in your favorites.' })
      return
    }
    if (action === 'remove' && !profile?.favoriteOpenings.includes(favoriteOpening)) {
      setOpeningsStatus({ type: 'error', message: 'This opening is not in your favorites.' })
      return
    }

    setOpeningsSubmitting(true)
    try {
      const endpoint = action === 'add' ? 'addFavoriteOpening' : 'deleteFavoriteOpening'
      const res = await fetch(apiUrl(`/api/users/${user.userId}/${endpoint}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingName: favoriteOpening }),
      })
      const payload = (await res.json()) as { message?: string }
      if (!res.ok) {
        throw new Error(payload.message ?? 'Favorite openings update failed.')
      }

      await refreshProfile(user.userId)
      setOpeningsStatus({
        type: 'success',
        message: payload.message ?? (action === 'add'
          ? 'Favorite opening added successfully.'
          : 'Favorite opening removed successfully.'),
      })
      form.reset()
    } catch (err) {
      setOpeningsStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Favorite openings update failed.',
      })
    } finally {
      setOpeningsSubmitting(false)
    }
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'

  const filteredGameHistory = useMemo(() => {
    const colorFiltered = gameHistory.filter((row) =>
      historyColorFilter === 'all' ? true : row.your_color === historyColorFilter,
    )

    const resultFiltered = colorFiltered.filter((row) => {
      if (historyResultFilter === 'all') {
        return true
      }
      const outcome = formatOutcome(row.result, row.your_color).toLowerCase()
      return outcome === historyResultFilter
    })

    const sorted = [...resultFiltered].sort((a, b) =>
      historySort === 'newest' ? b.game_id - a.game_id : a.game_id - b.game_id,
    )

    return sorted
  }, [gameHistory, historyColorFilter, historyResultFilter, historySort])

  const historyStats = useMemo(() => {
    let wins = 0
    let losses = 0
    let draws = 0
    for (const game of filteredGameHistory) {
      const outcome = formatOutcome(game.result, game.your_color)
      if (outcome === 'Win') wins += 1
      if (outcome === 'Loss') losses += 1
      if (outcome === 'Draw') draws += 1
    }
    return {
      played: filteredGameHistory.length,
      wins,
      losses,
      draws,
    }
  }, [filteredGameHistory])

  async function handleUpdateUsername(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const form = event.currentTarget
    const formData = new FormData(form)
    const nextUsername = formData.get('newUsername')?.toString().trim() ?? ''

    if (!nextUsername) {
      setUsernameStatus({ type: 'error', message: 'Please enter a username.' })
      return
    }
    if (nextUsername === user.username) {
      setUsernameStatus({ type: 'error', message: 'New username matches current username.' })
      return
    }

    setUsernameSubmitting(true)
    setUsernameStatus(null)
    try {
      const res = await fetch(apiUrl(`/api/users/${user.userId}/update-username`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextUsername }),
      })
      const payload = (await res.json()) as { message?: string; username?: string }
      if (!res.ok) {
        throw new Error(payload.message ?? 'Failed to update username.')
      }

      login({
        userId: user.userId,
        username: payload.username ?? nextUsername,
      })
      await refreshProfile(user.userId)
      setUsernameStatus({ type: 'success', message: payload.message ?? 'Username updated successfully.' })
      setShowUsernameForm(false)
      form.reset()
    } catch (err) {
      setUsernameStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update username.',
      })
    } finally {
      setUsernameSubmitting(false)
    }
  }

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
        <div>
          <p className="stat-label">Awards</p>
          <p className="profile-value">{profile?.awards.length ?? 0}</p>
        </div>
      </article>

      <article className="panel-card">
        <h3>User awards</h3>
        {!profile || profile.awards.length === 0 ? (
          <p className="fine-print">No awards earned yet.</p>
        ) : (
          <ul className="simple-list">
            {profile.awards.map((award) => (
              <li key={award.award_name}>
                <strong>{award.award_name}</strong> — {award.description}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel-card">
        <h3>Game history</h3>
        <p className="fine-print" style={{ marginBottom: '12px' }}>
          Completed games on this site. Select a row to replay moves on the board.
        </p>
        <div className="top-nav" style={{ marginBottom: '12px' }}>
          <label>
            Sort
            <select value={historySort} onChange={(event) => setHistorySort(event.target.value as 'newest' | 'oldest')}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <label>
            Color
            <select
              value={historyColorFilter}
              onChange={(event) => setHistoryColorFilter(event.target.value as 'all' | 'white' | 'black')}
            >
              <option value="all">All colors</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label>
            Result
            <select
              value={historyResultFilter}
              onChange={(event) => setHistoryResultFilter(event.target.value as 'all' | 'win' | 'loss' | 'draw')}
            >
              <option value="all">All results</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="draw">Draw</option>
            </select>
          </label>
        </div>
        {historyError && <p className="status-message error">{historyError}</p>}
        {!historyError && (
          <ul className="simple-list" style={{ marginBottom: '12px' }}>
            <li>
              Games played: <strong>{historyStats.played}</strong>
            </li>
            <li>
              W / L / D: <strong>{historyStats.wins}</strong> / <strong>{historyStats.losses}</strong> / <strong>{historyStats.draws}</strong>
            </li>
          </ul>
        )}
        {!historyError && filteredGameHistory.length === 0 && (
          <p className="fine-print">No finished games yet.</p>
        )}
        {filteredGameHistory.length > 0 && (
          <div className="profile-history-layout">
            <div className="history-table-wrap">
              <table className="game-history-table">
                <caption className="sr-only">Your completed games</caption>
                <thead>
                  <tr>
                    <th scope="col">Opponent</th>
                    <th scope="col">You</th>
                    <th scope="col">Result</th>
                    <th scope="col">Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGameHistory.map((row) => {
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
              onClick={() => { setShowUsernameForm((v) => !v); setUsernameStatus(null) }}
            >
              {showUsernameForm ? 'Cancel' : 'Update username'}
            </button>
            {showUsernameForm && (
              <form className="signup-form" style={{ marginTop: '16px' }} onSubmit={handleUpdateUsername}>
                <label>
                  New username
                  <input type="text" name="newUsername" placeholder="Enter new username" minLength={3} required />
                </label>
                <button type="submit" className="primary-action" disabled={usernameSubmitting}>
                  {usernameSubmitting ? 'Saving...' : 'Save username'}
                </button>
                {usernameStatus && (
                  <p className={usernameStatus.type === 'success' ? 'status-message success' : 'status-message error'} role="status" aria-live="polite">
                    {usernameStatus.message}
                  </p>
                )}
              </form>
            )}
          </li>
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
              onClick={() => { setShowFavoriteOpenings((v) => !v); setOpeningsStatus(null) }}
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
                <button type="submit" className="primary-action" disabled={openingsSubmitting}>
                  {openingsSubmitting ? 'Saving...' : 'Submit'}
                </button>
                {openingsStatus && (
                  <p className={openingsStatus.type === 'success' ? 'status-message success' : 'status-message error'} role="status" aria-live="polite">
                    {openingsStatus.message}
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
