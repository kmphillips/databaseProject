import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import type { PersistedMove } from '../types'
import { ChessGameBoard } from './ChessGameBoard'

type GameReplayViewerProps = {
  moves: PersistedMove[]
  whiteLabel: string
  blackLabel: string
  /** Which color sits at the bottom of the board (read-only review). */
  boardOrientation?: 'white' | 'black'
}

export function GameReplayViewer({
  moves,
  whiteLabel,
  blackLabel,
  boardOrientation = 'white',
}: GameReplayViewerProps) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)

  useEffect(() => {
    setCurrentMoveIndex(0)
  }, [moves])

  const reviewFen = useMemo(() => {
    const replay = new Chess()
    for (const move of moves.slice(0, currentMoveIndex)) {
      const applied = replay.move(move.notation)
      if (!applied) {
        break
      }
    }
    return replay.fen()
  }, [moves, currentMoveIndex])

  const topLabel = boardOrientation === 'white' ? blackLabel : whiteLabel
  const bottomLabel = boardOrientation === 'white' ? whiteLabel : blackLabel

  return (
    <div className="replay-viewer">
      <p className="fine-print">Top: {topLabel}</p>
      <ChessGameBoard
        fen={reviewFen}
        onPieceDrop={() => false}
        canPlay={false}
        playerColor={boardOrientation}
      />
      <p className="fine-print">Bottom: {bottomLabel}</p>
      <div className="top-nav replay-controls">
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
          onClick={() => setCurrentMoveIndex((prev) => Math.min(moves.length, prev + 1))}
          disabled={currentMoveIndex >= moves.length}
        >
          Next move
        </button>
      </div>
      <p className="fine-print">
        Position {currentMoveIndex} / {moves.length}
      </p>
      <div className="replay-move-list">
        <h4 className="replay-move-list-title">Moves</h4>
        {moves.length === 0 ? (
          <p className="fine-print">No moves recorded.</p>
        ) : (
          <ol className="move-history-list">
            {moves.map((move) => (
              <li key={`${move.move_number}-${move.notation}`}>{move.notation}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
