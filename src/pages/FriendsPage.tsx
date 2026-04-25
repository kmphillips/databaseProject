import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useAuth } from '../App'

type Friend = {
  user_id: number
  username: string
  rating: number
}

type FriendProfile = {
  username: string
  createdAt: string
  rating: number
  favoriteOpenings: string[]
}

type Tab = 'friends' | 'requests' | 'add'

export function FriendsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('friends')

  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [searchResults, setSearchResults] = useState<Friend[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const [loadingFriends, setLoadingFriends] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loadingFriendProfile, setLoadingFriendProfile] = useState(false)

  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedFriendProfile, setSelectedFriendProfile] = useState<FriendProfile | null>(null)
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)

  function clearStatus() {
    setActionStatus(null)
  }

  useEffect(() => {
    if (!user) return
    setLoadingFriends(true)
    fetch(`/api/friends/${user.userId}`)
      .then((res) => res.json())
      .then((data) => setFriends(data.friends ?? []))
      .catch(() => {})
      .finally(() => setLoadingFriends(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoadingRequests(true)
    fetch(`/api/friends/${user.userId}/pending`)
      .then((res) => res.json())
      .then((data) => setPendingRequests(data.requests ?? []))
      .catch(() => {})
      .finally(() => setLoadingRequests(false))
  }, [user])

  async function handleSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || searchQuery.trim().length === 0) return

    setSearching(true)
    setSearchResults([])
    clearStatus()

    try {
      const res = await fetch(`/api/users/search?username=${encodeURIComponent(searchQuery)}&requesterId=${user.userId}`)
      const data = await res.json()
      setSearchResults(data.users ?? [])
      if ((data.users ?? []).length === 0) {
        setActionStatus({ type: 'error', message: 'No users found.' })
      }
    } catch {
      setActionStatus({ type: 'error', message: 'Search failed.' })
    } finally {
      setSearching(false)
    }
  }

  async function sendRequest(friendUserId: number) {
    if (!user) return
    clearStatus()

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, friendUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setActionStatus({ type: 'success', message: data.message })
      setSearchResults((prev) => prev.filter((u) => u.user_id !== friendUserId))
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send request.' })
    }
  }

  async function acceptRequest(friendUserId: number) {
    if (!user) return
    clearStatus()

    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, friendUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      const accepted = pendingRequests.find((r) => r.user_id === friendUserId)
      setPendingRequests((prev) => prev.filter((r) => r.user_id !== friendUserId))
      if (accepted) setFriends((prev) => [...prev, accepted])
      setActionStatus({ type: 'success', message: data.message })
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to accept request.' })
    }
  }

  async function removeFriend(friendUserId: number) {
    if (!user) return
    clearStatus()

    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, friendUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setFriends((prev) => prev.filter((f) => f.user_id !== friendUserId))
      if (selectedFriendId === friendUserId) {
        setSelectedFriendId(null)
        setSelectedFriendProfile(null)
      }
      setActionStatus({ type: 'success', message: data.message })
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove friend.' })
    }
  }

  async function rejectRequest(friendUserId: number) {
    if (!user) return
    clearStatus()

    try {
      const res = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, friendUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setPendingRequests((prev) => prev.filter((r) => r.user_id !== friendUserId))
      setActionStatus({ type: 'success', message: data.message })
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to decline request.' })
    }
  }

  function switchTab(next: Tab) {
    setTab(next)
    clearStatus()
    setSearchResults([])
    setSearchQuery('')
  }

  async function handleViewFriendProfile(friendId: number) {
    setLoadingFriendProfile(true)
    setSelectedFriendId(friendId)
    clearStatus()
    try {
      const res = await fetch(`/api/users/${friendId}`)
      const data = (await res.json()) as FriendProfile & { message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? 'Could not load friend profile.')
      }
      setSelectedFriendProfile(data)
    } catch (err) {
      setSelectedFriendProfile(null)
      setSelectedFriendId(null)
      setActionStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not load friend profile.',
      })
    } finally {
      setLoadingFriendProfile(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="friends-title">
      <div className="panel-header">
        <p className="eyebrow">Social</p>
        <h2 id="friends-title">Friends</h2>
      </div>

      <div className="friends-tabs">
        <button
          type="button"
          className={tab === 'friends' ? 'nav-link nav-link-active' : 'nav-link'}
          onClick={() => switchTab('friends')}
        >
          Friends {friends.length > 0 && `(${friends.length})`}
        </button>
        <button
          type="button"
          className={tab === 'requests' ? 'nav-link nav-link-active' : 'nav-link'}
          onClick={() => switchTab('requests')}
        >
          Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
        </button>
        <button
          type="button"
          className={tab === 'add' ? 'nav-link nav-link-active' : 'nav-link'}
          onClick={() => switchTab('add')}
        >
          Add friend
        </button>
      </div>

      {actionStatus && (
        <p
          className={actionStatus.type === 'success' ? 'status-message success' : 'status-message error'}
          role="status"
          aria-live="polite"
        >
          {actionStatus.message}
        </p>
      )}

      {tab === 'friends' && (
        <div className="friends-profile-layout">
          <article className="panel-card">
            {loadingFriends ? (
              <p className="fine-print">Loading friends...</p>
            ) : friends.length === 0 ? (
              <p className="fine-print">You have no friends yet. Send a request to get started.</p>
            ) : (
              <ul className="friends-list">
                {friends.map((friend) => (
                  <li key={friend.user_id} className="friends-list-item">
                    <button
                      type="button"
                      className="friend-name-button"
                      onClick={() => {
                        void handleViewFriendProfile(friend.user_id)
                      }}
                    >
                      {friend.username}
                    </button>
                    <span className="stat-label">Rating: {friend.rating}</span>
                    <button
                      type="button"
                      className="link-action"
                      onClick={() => {
                        void handleViewFriendProfile(friend.user_id)
                      }}
                    >
                      View profile
                    </button>
                    <button type="button" className="link-action" onClick={() => removeFriend(friend.user_id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel-card">
            <h3>Friend profile</h3>
            {loadingFriendProfile ? (
              <p className="fine-print">Loading profile...</p>
            ) : selectedFriendProfile ? (
              <ul className="simple-list">
                <li>
                  Username: <strong>{selectedFriendProfile.username}</strong>
                </li>
                <li>
                  Rating: <strong>{selectedFriendProfile.rating}</strong>
                </li>
                <li>
                  Member since:{' '}
                  <strong>
                    {selectedFriendProfile.createdAt
                      ? new Date(selectedFriendProfile.createdAt).toLocaleDateString()
                      : '—'}
                  </strong>
                </li>
                <li>
                  Favorite openings:{' '}
                  <strong>
                    {selectedFriendProfile.favoriteOpenings.length > 0
                      ? selectedFriendProfile.favoriteOpenings.join(', ')
                      : 'None yet'}
                  </strong>
                </li>
              </ul>
            ) : (
              <p className="fine-print">Select a friend to view their profile.</p>
            )}
          </article>
        </div>
      )}

      {tab === 'requests' && (
        <article className="panel-card">
          {loadingRequests ? (
            <p className="fine-print">Loading requests...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="fine-print">No pending friend requests.</p>
          ) : (
            <ul className="friends-list">
              {pendingRequests.map((req) => (
                <li key={req.user_id} className="friends-list-item">
                  <span className="friends-username">{req.username}</span>
                  <span className="stat-label">Rating: {req.rating}</span>
                  <div className="friends-actions">
                    <button type="button" className="primary-action" style={{ padding: '6px 16px', fontSize: '13px' }} onClick={() => acceptRequest(req.user_id)}>
                      Accept
                    </button>
                    <button type="button" className="link-action" onClick={() => rejectRequest(req.user_id)}>
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {tab === 'add' && (
        <article className="panel-card">
          <form className="friends-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search by username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="friends-search-input"
            />
            <button type="submit" className="primary-action" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="friends-list" style={{ marginTop: '16px' }}>
              {searchResults.map((result) => (
                <li key={result.user_id} className="friends-list-item">
                  <span className="friends-username">{result.username}</span>
                  <span className="stat-label">Rating: {result.rating}</span>
                  <button type="button" className="link-action" onClick={() => sendRequest(result.user_id)}>
                    Add friend
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </section>
  )
}
