import type {
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
