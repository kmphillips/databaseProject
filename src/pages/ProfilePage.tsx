export function ProfilePage() {
  return (
    <section className="panel" aria-labelledby="profile-title">
      <div className="panel-header">
        <p className="eyebrow">Account</p>
        <h2 id="profile-title">Profile</h2>
      </div>

      <article className="panel-card profile-grid">
        <div>
          <p className="stat-label">Username</p>
          <p className="profile-value">queenGambit</p>
        </div>
        <div>
          <p className="stat-label">Favorite opening</p>
          <p className="profile-value">King\'s Indian Defense</p>
        </div>
        <div>
          <p className="stat-label">Member since</p>
          <p className="profile-value">March 2026</p>
        </div>
      </article>

      <article className="panel-card">
        <h3>Profile actions</h3>
        <ul className="simple-list">
          <li>Update avatar</li>
          <li>Change password</li>
          <li>Manage privacy settings</li>
        </ul>
      </article>
    </section>
  )
}
