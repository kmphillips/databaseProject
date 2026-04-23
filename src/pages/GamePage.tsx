import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { getSessionUser } from '../features/auth/session'
import { ChessGameBoard } from '../features/chess/components/ChessGameBoard'
import { useChessGame } from '../features/chess/hooks/useChessGame'
import {
  getActiveGame,
  getGameMoves,
  getOpenGames,
  joinGame,
  resignGame,
  startGame,
} from '../features/chess/services/chessApi'
import type { OpenSiteGame, PersistedMove } from '../features/chess/types'

export function GamePage() {
  const sessionUser = getSessionUser()
  const [activeGameId, setActiveGameId] = useState<number | null>(null)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'in_progress' | 'completed'>('waiting')
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null)
  const [opponentUsername, setOpponentUsername] = useState('Waiting for opponent')
  const [startGameStatus, setStartGameStatus] = useState('')
  const [isResigningGame, setIsResigningGame] = useState(false)
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningGame, setIsJoiningGame] = useState(false)
  const [creatorColorChoice, setCreatorColorChoice] = useState<'white' | 'black' | 'random'>(
    'random',
  )
  const [joinInviteCode, setJoinInviteCode] = useState('')
  const [openGames, setOpenGames] = useState<OpenSiteGame[]>([])
  const [persistedMoveHistory, setPersistedMoveHistory] = useState<PersistedMove[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)

  const refreshOpenGames = useCallback(async () => {
    try {
      const payload = await getOpenGames()
      setOpenGames(payload.games)
    } catch {
      // Preserve current list on transient failures.
    }
  }, [])

  const {
    fen,
    localMoveCount,
    turn,
    turnColor,
    isGameOver,
    isPersistingMove,
    onPieceDrop,
    resetGame,
    syncGameFromNotation,
  } =
    useChessGame({
      gameId: activeGameId,
      onMovePersisted: () => {
        if (activeGameId) {
          void refreshPersistedMoves(activeGameId)
        }
      },
    })

  const refreshPersistedMoves = useCallback(
    async (gameId: number) => {
      try {
        const payload = await getGameMoves(gameId)
        let previousMoveCount = 0
        setPersistedMoveHistory((previousMoves) => {
          previousMoveCount = previousMoves.length
          return payload.moves
        })
        if (payload.moves.length >= localMoveCount) {
          syncGameFromNotation(payload.moves.map((move) => move.notation))
        }
        setCurrentMoveIndex((previousIndex) =>
          previousIndex >= previousMoveCount
            ? payload.moves.length
            : Math.min(previousIndex, payload.moves.length),
        )
      } catch {
        // Keep existing local UI state if move history refresh fails.
      }
    },
    [localMoveCount, syncGameFromNotation],
  )

  const refreshActiveGameForUser = useCallback(
    async (userId: number) => {
      try {
        const payload = await getActiveGame(userId)
        if (!payload.game) {
          setActiveGameId(null)
          setGameStatus('waiting')
          setPlayerColor(null)
          setOpponentUsername('Waiting for opponent')
          setPersistedMoveHistory([])
          setCurrentMoveIndex(0)
          return
        }
        setActiveGameId(payload.game.gameId)
        setGameStatus(payload.game.status as 'waiting' | 'in_progress' | 'completed')
        setPlayerColor(payload.game.playerColor)
        setOpponentUsername(payload.game.opponentUsername)
      } catch {
        // Silent fail keeps existing active state.
      }
    },
    [],
  )

  const reviewFen = useMemo(() => {
    const replay = new Chess()
    const movesToApply = persistedMoveHistory.slice(0, currentMoveIndex)
    for (const move of movesToApply) {
      const applied = replay.move(move.notation)
      if (!applied) {
        break
      }
    }
    return replay.fen()
  }, [persistedMoveHistory, currentMoveIndex])

  const isViewingLatestMove = currentMoveIndex === persistedMoveHistory.length
  const isUsersTurn = playerColor !== null && turnColor === playerColor
  const canPlay = useMemo(
    () =>
      Boolean(activeGameId) &&
      gameStatus === 'in_progress' &&
      !isCreatingGame &&
      !isJoiningGame &&
      isViewingLatestMove &&
      isUsersTurn,
    [activeGameId, gameStatus, isCreatingGame, isJoiningGame, isViewingLatestMove, isUsersTurn],
  )

  useEffect(() => {
    void refreshOpenGames()
  }, [refreshOpenGames])

  useEffect(() => {
    if (!sessionUser) {
      return
    }
    void (async () => {
      try {
        const payload = await getActiveGame(sessionUser.userId)
        if (!payload.game) {
          return
        }
        setActiveGameId(payload.game.gameId)
        setGameStatus(payload.game.status as 'waiting' | 'in_progress' | 'completed')
        setPlayerColor(payload.game.playerColor)
        setOpponentUsername(payload.game.opponentUsername)
        await refreshPersistedMoves(payload.game.gameId)
      } catch {
        // Silent fail keeps page usable if lookup fails.
      }
    })()
  }, [sessionUser, refreshPersistedMoves])

  useEffect(() => {
    if (!activeGameId) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshPersistedMoves(activeGameId)
      void refreshOpenGames()
      if (sessionUser) {
        void refreshActiveGameForUser(sessionUser.userId)
      }
    }, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeGameId, refreshPersistedMoves, refreshOpenGames, refreshActiveGameForUser, sessionUser])

  async function handleCreateGame(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionUser) {
      return
    }

    setIsCreatingGame(true)
    setStartGameStatus('')
    try {
      const result = await startGame({
        createdByUserId: sessionUser.userId,
        creatorColor: creatorColorChoice,
      })
      setActiveGameId(result.game.gameId)
      setGameStatus(result.game.status as 'waiting' | 'in_progress' | 'completed')
      setPlayerColor(result.game.playerColor)
      setOpponentUsername(result.game.opponentUsername)
      setPersistedMoveHistory([])
      setCurrentMoveIndex(0)
      resetGame()
      await refreshPersistedMoves(result.game.gameId)
      await refreshOpenGames()
      setStartGameStatus(
        `Open game #${result.game.gameId} created. Invite code: ${result.inviteCode ?? 'N/A'}.`,
      )
    } catch (error) {
      setStartGameStatus(
        error instanceof Error ? error.message : 'Could not create game.',
      )
    } finally {
      setIsCreatingGame(false)
    }
  }

  async function handleJoinByCode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionUser) {
      return
    }

    const cleanInviteCode = joinInviteCode.trim()
    if (!cleanInviteCode) {
      setStartGameStatus('Enter an invite code.')
      return
    }

    setIsJoiningGame(true)
    try {
      const result = await joinGame({
        userId: sessionUser.userId,
        inviteCode: cleanInviteCode,
      })
      setActiveGameId(result.game.gameId)
      setGameStatus(result.game.status as 'waiting' | 'in_progress' | 'completed')
      setPlayerColor(result.game.playerColor)
      setOpponentUsername(result.game.opponentUsername)
      setPersistedMoveHistory([])
      setCurrentMoveIndex(0)
      resetGame()
      await refreshPersistedMoves(result.game.gameId)
      await refreshOpenGames()
      setStartGameStatus(
        `Joined game #${result.game.gameId}: ${result.game.whiteUsername} vs ${result.game.blackUsername}.`,
      )
    } catch (error) {
      setStartGameStatus(
        error instanceof Error ? error.message : 'Could not join game.',
      )
    } finally {
      setIsJoiningGame(false)
    }
  }

  async function handleJoinFromList(inviteCode: string) {
    if (!sessionUser) {
      return
    }

    setJoinInviteCode(inviteCode)
    setIsJoiningGame(true)
    try {
      const result = await joinGame({
        userId: sessionUser.userId,
        inviteCode,
      })
      setActiveGameId(result.game.gameId)
      setGameStatus(result.game.status as 'waiting' | 'in_progress' | 'completed')
      setPlayerColor(result.game.playerColor)
      setOpponentUsername(result.game.opponentUsername)
      setPersistedMoveHistory([])
      setCurrentMoveIndex(0)
      resetGame()
      await refreshPersistedMoves(result.game.gameId)
      await refreshOpenGames()
      setStartGameStatus(
        `Joined game #${result.game.gameId}: ${result.game.whiteUsername} vs ${result.game.blackUsername}.`,
      )
    } catch (error) {
      setStartGameStatus(
        error instanceof Error ? error.message : 'Could not join game.',
      )
    } finally {
      setIsJoiningGame(false)
    }
  }

  async function handleResignGame() {
    if (!sessionUser || !activeGameId) {
      return
    }

    setIsResigningGame(true)
    try {
      await resignGame(activeGameId, sessionUser.userId)
      await refreshActiveGameForUser(sessionUser.userId)
      await refreshOpenGames()
      setStartGameStatus('You resigned the game.')
    } catch (error) {
      setStartGameStatus(
        error instanceof Error ? error.message : 'Could not resign game.',
      )
    } finally {
      setIsResigningGame(false)
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
          <p className="fine-print">Top: {opponentUsername}</p>
          <ChessGameBoard
            fen={isViewingLatestMove ? fen : reviewFen}
            onPieceDrop={onPieceDrop}
            canPlay={canPlay}
            playerColor={playerColor}
          />
          <p className="fine-print">Bottom: {sessionUser.username}</p>
          <div className="top-nav">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setCurrentMoveIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentMoveIndex === 0}
            >
              Previous move
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setCurrentMoveIndex((prev) =>
                  Math.min(persistedMoveHistory.length, prev + 1),
                )
              }
              disabled={currentMoveIndex >= persistedMoveHistory.length}
            >
              Next move
            </button>
          </div>
        </article>

        <article className="panel-card">
          <h3>Game setup</h3>
          <p className="fine-print">Logged in as: {sessionUser.username}</p>
          <form className="signup-form" onSubmit={handleCreateGame}>
            <label>
              Your color
              <select
                value={creatorColorChoice}
                onChange={(event) =>
                  setCreatorColorChoice(
                    event.target.value as 'white' | 'black' | 'random',
                  )
                }
              >
                <option value="random">Random</option>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
            <button type="submit" className="primary-action" disabled={isCreatingGame}>
              {isCreatingGame ? 'Creating game...' : 'Create open game'}
            </button>
          </form>

          <form className="signup-form" onSubmit={handleJoinByCode}>
            <label>
              Join by invite code
              <input
                type="text"
                value={joinInviteCode}
                onChange={(event) => setJoinInviteCode(event.target.value)}
                placeholder="LOCALXXXXXXXXXXXX"
                required
              />
            </label>
            <button type="submit" className="secondary-action" disabled={isJoiningGame}>
              {isJoiningGame ? 'Joining...' : 'Join game'}
            </button>
          </form>

          {startGameStatus && <p className="fine-print">{startGameStatus}</p>}

          <h3>Open games</h3>
          {openGames.length === 0 ? (
            <p className="fine-print">No open games right now.</p>
          ) : (
            <ul className="simple-list">
              {openGames.map((openGame) => (
                <li key={openGame.game_id}>
                  {openGame.creator_username} - {openGame.invite_code}
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      void handleJoinFromList(openGame.invite_code)
                    }}
                    disabled={isJoiningGame}
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
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
              Status: <strong>{gameStatus === 'waiting' ? 'Waiting for opponent' : isGameOver ? 'Game over' : 'In progress'}</strong>
            </li>
            <li>
              Move sync: <strong>{isPersistingMove ? 'Saving...' : 'Up to date'}</strong>
            </li>
            <li>
              You are playing: <strong>{playerColor ?? 'Not assigned'}</strong>
            </li>
            <li>
              Review position: <strong>{currentMoveIndex}</strong> /{' '}
              <strong>{persistedMoveHistory.length}</strong>
            </li>
          </ul>

          <button type="button" className="secondary-action" onClick={resetGame}>
            Reset board
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              void handleResignGame()
            }}
            disabled={!activeGameId || gameStatus !== 'in_progress' || isResigningGame}
          >
            {isResigningGame ? 'Resigning...' : 'Resign game'}
          </button>
        </article>

        <article className="panel-card">
          <h3>Move history</h3>
          {persistedMoveHistory.length === 0 ? (
            <p className="fine-print">No moves yet. Make the first move on the board.</p>
          ) : (
            <ol className="move-history-list">
              {persistedMoveHistory.map((move) => (
                <li key={`${move.move_number}-${move.notation}`}>
                  {move.notation}
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  )
}
