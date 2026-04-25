import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../App'
import { GameReplayViewer } from '../features/chess/components/GameReplayViewer'
import {
  deleteUploadedGame,
  getGameMoves,
  getUploadedGames,
  importPgn,
} from '../features/chess/services/chessApi'
import type { PersistedMove, UploadedGameRow } from '../features/chess/types'

type TabId = 'upload' | 'library'

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

export function PgnUploadPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('upload')

  const [pgnText, setPgnText] = useState('')
  const [userColor, setUserColor] = useState<'white' | 'black'>('white')
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [games, setGames] = useState<UploadedGameRow[]>([])
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(false)

  const [selected, setSelected] = useState<UploadedGameRow | null>(null)
  const [moves, setMoves] = useState<PersistedMove[]>([])
  const [movesLoading, setMovesLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      return
    }
    setListLoading(true)
    setListError('')
    try {
      const payload = await getUploadedGames(user.userId)
      setGames(payload.games)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not load uploads.')
    } finally {
      setListLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (tab === 'library' && user) {
      void refreshLibrary()
    }
  }, [tab, user, refreshLibrary])

  useEffect(() => {
    if (!selected) {
      setMoves([])
      return
    }
    void (async () => {
      setMovesLoading(true)
      try {
        const payload = await getGameMoves(selected.game_id)
        setMoves(payload.moves)
      } catch {
        setMoves([])
      } finally {
        setMovesLoading(false)
      }
    })()
  }, [selected])

  async function handleFileChange(file: File | null) {
    setUploadMessage(null)
    if (!file) {
      setPgnText('')
      return
    }
    const text = await file.text()
    setPgnText(text)
  }

  async function handleSubmitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!user) {
      return
    }
    if (!pgnText.trim()) {
      setUploadMessage({ type: 'err', text: 'Choose a .pgn file or paste PGN text first.' })
      return
    }

    setUploading(true)
    setUploadMessage(null)
    try {
      const result = await importPgn({
        userId: user.userId,
        userColor,
        pgnText,
      })
      setUploadMessage({ type: 'ok', text: result.message })
      setPgnText('')
      const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement | null
      if (fileInput) {
        fileInput.value = ''
      }
      void refreshLibrary()
      setTab('library')
    } catch (err) {
      setUploadMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Import failed.',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(gameId: number) {
    if (!user) {
      return
    }
    if (!window.confirm('Delete this uploaded game from your library? This cannot be undone.')) {
      return
    }
    setDeletingId(gameId)
    try {
      await deleteUploadedGame(gameId, user.userId)
      if (selected?.game_id === gameId) {
        setSelected(null)
      }
      await refreshLibrary()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="panel" aria-labelledby="pgn-upload-title">
      <div className="panel-header">
        <p className="eyebrow">Imports</p>
        <h2 id="pgn-upload-title">PGN uploads</h2>
      </div>

      <div className="pgn-tabs" role="tablist" aria-label="PGN sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={tab === 'upload' ? 'pgn-tab pgn-tab-active' : 'pgn-tab'}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'library'}
          className={tab === 'library' ? 'pgn-tab pgn-tab-active' : 'pgn-tab'}
          onClick={() => setTab('library')}
        >
          My uploads
        </button>
      </div>

      {tab === 'upload' && (
        <article className="panel-card">
          <h3>Import a PGN file</h3>
          <p className="fine-print">
            One file can include several games; each will get its own row in Games, UploadedGame, and Moves.
            Choose which color <strong>you</strong> played for this upload (used for win/loss labels in your
            library).
          </p>
          <form className="signup-form" onSubmit={handleSubmitUpload}>
            <label>
              PGN file
              <input
                type="file"
                accept=".pgn,.txt,text/plain"
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            <fieldset className="pgn-color-fieldset">
              <legend className="stat-label">You played as</legend>
              <label className="pgn-inline-label">
                <input
                  type="radio"
                  name="userColor"
                  value="white"
                  checked={userColor === 'white'}
                  onChange={() => setUserColor('white')}
                />
                White
              </label>
              <label className="pgn-inline-label">
                <input
                  type="radio"
                  name="userColor"
                  value="black"
                  checked={userColor === 'black'}
                  onChange={() => setUserColor('black')}
                />
                Black
              </label>
            </fieldset>
            <label>
              Optional: paste or edit PGN text
              <textarea
                rows={10}
                value={pgnText}
                onChange={(event) => setPgnText(event.target.value)}
                placeholder="[Event &quot;?&quot;]&#10;[White &quot;You&quot;]&#10;[Black &quot;Opponent&quot;]&#10;&#10;1. e4 e5 *"
              />
            </label>
            <button type="submit" className="primary-action" disabled={uploading}>
              {uploading ? 'Importing…' : 'Import to database'}
            </button>
            {uploadMessage && (
              <p
                className={uploadMessage.type === 'ok' ? 'status-message success' : 'status-message error'}
                role="status"
              >
                {uploadMessage.text}
              </p>
            )}
          </form>
        </article>
      )}

      {tab === 'library' && user && (
        <div className="profile-history-layout">
          <article className="panel-card">
            <h3>Your uploaded games</h3>
            {listLoading && <p className="fine-print">Loading…</p>}
            {listError && <p className="status-message error">{listError}</p>}
            {!listLoading && !listError && games.length === 0 && (
              <p className="fine-print">No uploads yet. Use the Upload tab to add a PGN file.</p>
            )}
            {games.length > 0 && (
              <div className="history-table-wrap">
                <table className="game-history-table">
                  <caption className="sr-only">Uploaded games</caption>
                  <thead>
                    <tr>
                      <th scope="col">Game</th>
                      <th scope="col">Opponent</th>
                      <th scope="col">You</th>
                      <th scope="col">Result</th>
                      <th scope="col">Uploaded</th>
                      <th scope="col"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((row) => {
                      const isSelected = selected?.game_id === row.game_id
                      return (
                        <tr
                          key={row.game_id}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isSelected}
                          className={
                            isSelected ? 'game-history-row game-history-row-selected' : 'game-history-row'
                          }
                          onClick={() =>
                            setSelected((current) =>
                              current?.game_id === row.game_id ? null : row,
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelected((current) =>
                                current?.game_id === row.game_id ? null : row,
                              )
                            }
                          }}
                        >
                          <td>
                            <span className="game-history-id">#{row.game_id}</span>
                          </td>
                          <td>{row.opponent_name}</td>
                          <td>{colorLabel(row.user_color)}</td>
                          <td>{formatOutcome(row.result, row.user_color)}</td>
                          <td>
                            {row.uploaded_at
                              ? new Date(row.uploaded_at).toLocaleString()
                              : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="link-action"
                              disabled={deletingId === row.game_id}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDelete(row.game_id)
                              }}
                            >
                              {deletingId === row.game_id ? 'Deleting…' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {selected && (
            <article className="panel-card profile-replay-card">
              <div className="profile-replay-header">
                <h4>
                  #{selected.game_id} vs {selected.opponent_name}
                </h4>
                <button type="button" className="link-action" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
              <p className="fine-print">
                You recorded as {colorLabel(selected.user_color)} —{' '}
                {formatOutcome(selected.result, selected.user_color)}
                {selected.time_control ? ` · ${selected.time_control}` : ''}
              </p>
              {selected.context && <p className="fine-print">{selected.context}</p>}
              {movesLoading ? (
                <p className="fine-print">Loading moves…</p>
              ) : user ? (
                <GameReplayViewer
                  moves={moves}
                  whiteLabel={
                    selected.user_color === 'white' ? user.username : selected.opponent_name
                  }
                  blackLabel={
                    selected.user_color === 'black' ? user.username : selected.opponent_name
                  }
                  boardOrientation={selected.user_color}
                />
              ) : null}
            </article>
          )}
        </div>
      )}
    </section>
  )
}
