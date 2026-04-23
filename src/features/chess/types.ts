export type PersistMovePayload = {
  gameId: number
  moveNumber: number
  from: string
  to: string
  san: string
  fenAfterMove: string
}

export type PersistMoveResult = {
  ok: boolean
}

export type StartGamePayload = {
  createdByUserId: number
  opponentUsername: string
}

export type StartGameResult = {
  message: string
  game: {
    gameId: number
    whiteUsername: string
    blackUsername: string
  }
}
