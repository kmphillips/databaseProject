import type {
  ActiveGameResult,
  GetGameMovesResult,
  GetOpenGamesResult,
  JoinGamePayload,
  PersistMovePayload,
  PersistMoveResult,
  StartGamePayload,
  StartGameResult,
} from '../types'

export async function startGame(payload: StartGamePayload): Promise<StartGameResult> {
  const response = await fetch('/api/games/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as StartGameResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to start game.')
  }

  return body
}

export async function getOpenGames(): Promise<GetOpenGamesResult> {
  const response = await fetch('/api/games/open')
  const body = (await response.json()) as GetOpenGamesResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load open games.')
  }

  return body
}

export async function joinGame(payload: JoinGamePayload): Promise<StartGameResult> {
  const response = await fetch('/api/games/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as StartGameResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to join game.')
  }

  return body
}

export async function persistMove(payload: PersistMovePayload): Promise<PersistMoveResult> {
  const response = await fetch('/api/games/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = (await response.json()) as { message?: string }
    throw new Error(body.message ?? 'Failed to persist move.')
  }

  return { ok: true }
}

export async function getGameMoves(gameId: number): Promise<GetGameMovesResult> {
  const response = await fetch(`/api/games/${gameId}/moves`)
  const body = (await response.json()) as GetGameMovesResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load move history.')
  }

  return body
}

export async function getActiveGame(userId: number): Promise<ActiveGameResult> {
  const response = await fetch(`/api/games/active/${userId}`)
  const body = (await response.json()) as ActiveGameResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load active game.')
  }

  return body
}

export async function resignGame(gameId: number, userId: number): Promise<{ ok: boolean }> {
  const response = await fetch('/api/games/resign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gameId, userId }),
  })
  const body = (await response.json()) as { ok?: boolean; message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to resign game.')
  }

  return { ok: true }
}
