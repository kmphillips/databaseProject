import { useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { persistMove } from '../services/chessApi'

type UseChessGameOptions = {
  gameId: number | null
}

export function useChessGame({ gameId }: UseChessGameOptions) {
  const [game, setGame] = useState(() => new Chess())
  const [isPersistingMove, setIsPersistingMove] = useState(false)

  const fen = game.fen()
  const turn = game.turn() === 'w' ? 'White' : 'Black'
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
    setGame(new Chess())
  }

  function onPieceDrop(sourceSquare: string, targetSquare: string) {
    const nextGame = new Chess(game.fen())
    const move = nextGame.move({
      from: sourceSquare as Square,
      to: targetSquare as Square,
      promotion: 'q',
    })

    if (move === null) {
      return false
    }

    setGame(nextGame)

    if (!gameId) {
      return true
    }

    const moveNumber = nextGame.history().length
    setIsPersistingMove(true)
    void persistMove({
      gameId,
      moveNumber,
      from: move.from,
      to: move.to,
      san: move.san,
      fenAfterMove: nextGame.fen(),
    }).finally(() => {
      setIsPersistingMove(false)
    })

    return true
  }

  return {
    fen,
    turn,
    isGameOver,
    isPersistingMove,
    moveHistory,
    onPieceDrop,
    resetGame,
  }
}
