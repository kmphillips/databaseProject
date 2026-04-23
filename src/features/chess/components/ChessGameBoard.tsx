import { Chessboard } from 'react-chessboard'

type ChessGameBoardProps = {
  fen: string
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean
  canPlay: boolean
}

export function ChessGameBoard({ fen, onPieceDrop, canPlay }: ChessGameBoardProps) {
  return (
    <div className="chessboard-wrap">
      <Chessboard
        options={{
          position: fen,
          allowDragging: canPlay,
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            onPieceDrop(sourceSquare, targetSquare ?? ''),
        }}
      />
    </div>
  )
}
