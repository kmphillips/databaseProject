const recentMatches = [
  { id: 1, opponent: 'rookRunner', result: 'Win', opening: 'Sicilian Defense' },
  { id: 2, opponent: 'castleKing', result: 'Loss', opening: 'French Defense' },
  { id: 3, opponent: 'pawnStorm', result: 'Win', opening: 'Queen\'s Gambit' },
]

export function DashboardPage() {
  return (
    <section className="panel" aria-labelledby="dashboard-title">
      <div className="panel-header">
        <p className="eyebrow">Overview</p>
        <h2 id="dashboard-title">Dashboard</h2>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Current rating</p>
          <p className="stat-value">1420</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Games this week</p>
          <p className="stat-value">9</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Win streak</p>
          <p className="stat-value">3</p>
        </article>
      </div>

      <article className="panel-card">
        <h3>Recent matches</h3>
        <ul className="simple-list">
          {recentMatches.map((match) => (
            <li key={match.id}>
              <strong>{match.opponent}</strong> • {match.result} • {match.opening}
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}
