import { useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { getSessionUser } from '../features/auth/session'
import { ChessGameBoard } from '../features/chess/components/ChessGameBoard'
import { useChessGame } from '../features/chess/hooks/useChessGame'
import { startGame } from '../features/chess/services/chessApi'

export function GamePage() {
  const sessionUser = getSessionUser()
  const [activeGameId, setActiveGameId] = useState<number | null>(null)
  const [opponentUsername, setOpponentUsername] = useState('')
  const [startGameStatus, setStartGameStatus] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)

  const { fen, turn, isGameOver, isPersistingMove, moveHistory, onPieceDrop, resetGame } =
    useChessGame({
      gameId: activeGameId,
    })

  const canPlay = useMemo(
    () => Boolean(activeGameId) && !isStartingGame,
    [activeGameId, isStartingGame],
  )

  async function handleStartGame(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionUser) {
      return
    }

    const cleanOpponent = opponentUsername.trim()
    if (!cleanOpponent) {
      setStartGameStatus('Enter an opponent username.')
      return
    }

    setIsStartingGame(true)
    setStartGameStatus('')
    try {
      const result = await startGame({
        createdByUserId: sessionUser.userId,
        opponentUsername: cleanOpponent,
      })
      setActiveGameId(result.game.gameId)
      resetGame()
      setStartGameStatus(
        `Game #${result.game.gameId} started: ${result.game.whiteUsername} vs ${result.game.blackUsername}.`,
      )
    } catch (error) {
      setStartGameStatus(
        error instanceof Error ? error.message : 'Could not start game.',
      )
    } finally {
      setIsStartingGame(false)
    }
  }

  if (!sessionUser) {
    return <Navigate to="/login" replace />
  }

  return (
    <section className="panel" aria-labelledby="game-title">
      <div className="panel-header">
        <p className="eyebrow">Play</p>
        <h2 id="game-title">Game</h2>
      </div>

      <div className="game-layout">
        <article className="panel-card">
          <h3>Live board</h3>
          <ChessGameBoard fen={fen} onPieceDrop={onPieceDrop} canPlay={canPlay} />
        </article>

        <article className="panel-card">
          <h3>Game setup</h3>
          <p className="fine-print">Logged in as: {sessionUser.username}</p>
          <form className="signup-form" onSubmit={handleStartGame}>
            <label>
              Opponent username
              <input
                type="text"
                value={opponentUsername}
                onChange={(event) => setOpponentUsername(event.target.value)}
                placeholder="Enter opponent username"
                required
              />
            </label>
            <button type="submit" className="primary-action" disabled={isStartingGame}>
              {isStartingGame ? 'Starting game...' : 'Start test game'}
            </button>
          </form>
          {startGameStatus && <p className="fine-print">{startGameStatus}</p>}
        </article>

        <article className="panel-card">
          <h3>Game state</h3>
          <ul className="simple-list game-meta-list">
            <li>
              Active game ID: <strong>{activeGameId ?? 'Not started'}</strong>
            </li>
            <li>
              Current turn: <strong>{turn}</strong>
            </li>
            <li>
              Status: <strong>{isGameOver ? 'Game over' : 'In progress'}</strong>
            </li>
            <li>
              Move sync: <strong>{isPersistingMove ? 'Saving...' : 'Up to date'}</strong>
            </li>
          </ul>

          <button type="button" className="secondary-action" onClick={resetGame}>
            Reset board
          </button>
        </article>

        <article className="panel-card">
          <h3>Move history</h3>
          {moveHistory.length === 0 ? (
            <p className="fine-print">No moves yet. Make the first move on the board.</p>
          ) : (
            <ol className="move-history-list">
              {moveHistory.map((move) => (
                <li key={move.id}>
                  {move.label} ({move.from} to {move.to})
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  )
}
