import { Chessboard } from 'react-chessboard'

type ChessGameBoardProps = {
  fen: string
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean
  canPlay: boolean
  playerColor: 'white' | 'black' | null
}

export function ChessGameBoard({ fen, onPieceDrop, canPlay, playerColor }: ChessGameBoardProps) {
  return (
    <div className="chessboard-wrap">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: playerColor ?? 'white',
          allowDragging: canPlay,
          canDragPiece: ({ piece }) => {
            if (!canPlay || !playerColor) {
              return false
            }
            const pieceCode = piece?.pieceType ?? ''
            return playerColor === 'white'
              ? pieceCode.startsWith('w')
              : pieceCode.startsWith('b')
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            onPieceDrop(sourceSquare, targetSquare ?? ''),
        }}
      />
    </div>
  )
}
