import type {
  ActiveGameResult,
  GetGameMovesResult,
  GetOpenGamesResult,
  HistoricalGamesResult,
  ImportPgnPayload,
  ImportPgnResult,
  JoinGamePayload,
  PersistMovePayload,
  PersistMoveResult,
  StartGamePayload,
  StartGameResult,
  UploadedGamesListResult,
  UserGameHistoryResult,
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

export async function getHistoricalGames(): Promise<HistoricalGamesResult> {
  const response = await fetch('/api/historical-games')
  const body = (await response.json()) as HistoricalGamesResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load historical games.')
  }

  return body
}

export async function getUserGameHistory(userId: number): Promise<UserGameHistoryResult> {
  const response = await fetch(`/api/users/${userId}/game-history`)
  const body = (await response.json()) as UserGameHistoryResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load game history.')
  }

  return body
}

export async function importPgn(payload: ImportPgnPayload): Promise<ImportPgnResult> {
  const response = await fetch('/api/uploads/pgn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await response.json()) as ImportPgnResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to import PGN.')
  }

  return body
}

export async function getUploadedGames(userId: number): Promise<UploadedGamesListResult> {
  const response = await fetch(`/api/users/${userId}/uploaded-games`)
  const body = (await response.json()) as UploadedGamesListResult & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to load uploaded games.')
  }

  return body
}

export async function deleteUploadedGame(gameId: number, userId: number): Promise<{ ok: boolean }> {
  const response = await fetch(`/api/uploads/games/${gameId}?userId=${userId}`, {
    method: 'DELETE',
  })
  const body = (await response.json()) as { ok?: boolean; message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Failed to delete game.')
  }

  return { ok: true }
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
