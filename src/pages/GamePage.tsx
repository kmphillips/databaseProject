export function GamePage() {
  const board = Array.from({ length: 8 }, (_, rowIndex) =>
    Array.from({ length: 8 }, (_, colIndex) => {
      const isLightSquare = (rowIndex + colIndex) % 2 === 0
      return {
        key: `${rowIndex}-${colIndex}`,
        squareClass: isLightSquare ? 'board-square light' : 'board-square dark',
      }
    }),
  )

  return (
    <section className="panel" aria-labelledby="game-title">
      <div className="panel-header">
        <p className="eyebrow">Play</p>
        <h2 id="game-title">Game</h2>
      </div>

      <div className="game-layout">
        <article className="panel-card">
          <h3>Live board</h3>
          <div className="board" role="img" aria-label="Chess board preview">
            {board.flat().map((square) => (
              <span key={square.key} className={square.squareClass} aria-hidden="true" />
            ))}
          </div>
        </article>

        <article className="panel-card">
          <h3>Game controls</h3>
          <ul className="simple-list">
            <li>Start ranked match</li>
            <li>Play a friend</li>
            <li>Review your last game</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
