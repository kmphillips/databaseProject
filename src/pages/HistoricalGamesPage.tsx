import { useEffect, useState } from 'react'
import { getGameMoves, getHistoricalGames } from '../features/chess/services/chessApi'
import { GameReplayViewer } from '../features/chess/components/GameReplayViewer'
import type { HistoricalGame, PersistedMove } from '../features/chess/types'

function formatHistoricalResult(result: string | null): string {
  if (result === 'white') {
    return 'White won'
  }
  if (result === 'black') {
    return 'Black won'
  }
  if (result === 'draw') {
    return 'Draw'
  }
  return 'Unknown'
}

export function HistoricalGamesPage() {
  const [historicalGames, setHistoricalGames] = useState<HistoricalGame[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [selectedGame, setSelectedGame] = useState<HistoricalGame | null>(null)
  const [moves, setMoves] = useState<PersistedMove[]>([])
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const payload = await getHistoricalGames()
        setHistoricalGames(payload.games)
        if (payload.games.length > 0) {
          const firstGame = payload.games[0]
          setSelectedGameId(firstGame.game_id)
          setSelectedGame(firstGame)
        }
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : 'Could not load historical games.',
        )
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedGameId) {
      return
    }

    const gameMetadata = historicalGames.find((game) => game.game_id === selectedGameId) ?? null
    setSelectedGame(gameMetadata)
    void (async () => {
      try {
        const payload = await getGameMoves(selectedGameId)
        setMoves(payload.moves)
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : 'Could not load game moves.',
        )
      }
    })()
  }, [selectedGameId, historicalGames])

  return (
    <section className="panel" aria-labelledby="historical-games-title">
      <div className="panel-header">
        <p className="eyebrow">Library</p>
        <h2 id="historical-games-title">Historical Games</h2>
      </div>

      <div className="game-layout">
        <article className="panel-card">
          <h3>Select game</h3>
          <label className="signup-form">
            Historical game
            <select
              value={selectedGameId ?? ''}
              onChange={(event) => setSelectedGameId(Number(event.target.value))}
            >
              {historicalGames.map((game) => (
                <option key={game.game_id} value={game.game_id}>
                  #{game.game_id} {game.white_famous_player} vs {game.black_famous_player}
                </option>
              ))}
            </select>
          </label>
          {statusMessage && <p className="fine-print">{statusMessage}</p>}

          {selectedGame && (
            <ul className="simple-list game-meta-list">
              <li>
                White: <strong>{selectedGame.white_famous_player}</strong>
              </li>
              <li>
                Black: <strong>{selectedGame.black_famous_player}</strong>
              </li>
              <li>
                Context: <strong>{selectedGame.context ?? 'N/A'}</strong>
              </li>
              <li>
                Result: <strong>{formatHistoricalResult(selectedGame.result)}</strong>
              </li>
            </ul>
          )}
        </article>

        <article className="panel-card">
          <h3>Board review</h3>
          {selectedGame && (
            <GameReplayViewer
              moves={moves}
              whiteLabel={selectedGame.white_famous_player}
              blackLabel={selectedGame.black_famous_player}
              boardOrientation="white"
            />
          )}
        </article>
      </div>
    </section>
  )
}
