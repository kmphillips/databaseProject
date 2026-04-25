import { useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { persistMove } from '../services/chessApi'

type UseChessGameOptions = {
  gameId: number | null
  onMovePersisted?: () => void
}

export function useChessGame({ gameId, onMovePersisted }: UseChessGameOptions) {
  const [game, setGame] = useState(() => new Chess())
  const gameRef = useRef(game)
  const [isPersistingMove, setIsPersistingMove] = useState(false)

  const fen = game.fen()
  const localMoveCount = game.history().length
  const turn = game.turn() === 'w' ? 'White' : 'Black'
  const turnColor = game.turn() === 'w' ? 'white' : 'black'
  const isGameOver = game.isGameOver()

  const moveHistory = useMemo(
    () =>
      game.history({ verbose: true }).map((move, index) => ({
        id: `${index + 1}-${move.from}-${move.to}`,
        label: `${index + 1}. ${move.san}`,
        from: move.from,
        to: move.to,
      })),
    [game],
  )

  function resetGame() {
    const freshGame = new Chess()
    gameRef.current = freshGame
    setGame(freshGame)
  }

  function syncGameFromNotation(moves: string[]) {
    const syncedGame = new Chess()
    for (const notation of moves) {
      const appliedMove = syncedGame.move(notation)
      if (!appliedMove) {
        break
      }
    }
    gameRef.current = syncedGame
    setGame(syncedGame)
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    const nextGame = new Chess(gameRef.current.fen())
    const move = nextGame.move({
      from: sourceSquare as Square,
      to: targetSquare as Square,
      promotion: 'q',
    })

    if (move === null) {
      return false
    }

    gameRef.current = nextGame
    setGame(nextGame)

    if (!gameId) {
      return true
    }

    const moveNumber = nextGame.history().length
    const gameResult =
      !nextGame.isGameOver()
        ? null
        : nextGame.isCheckmate()
          ? nextGame.turn() === 'w'
            ? 'black'
            : 'white'
          : 'draw'

    setIsPersistingMove(true)
    void persistMove({
      gameId,
      moveNumber,
      from: move.from,
      to: move.to,
      san: move.san,
      fenAfterMove: nextGame.fen(),
      gameResult,
    })
      .then(() => {
        onMovePersisted?.()
      })
      .finally(() => {
        setIsPersistingMove(false)
      })

    return true
  }

  return {
    fen,
    localMoveCount,
    turn,
    turnColor,
    isGameOver,
    isPersistingMove,
    moveHistory,
    onPieceDrop,
    resetGame,
    syncGameFromNotation,
  }
}
