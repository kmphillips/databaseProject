export type PersistMovePayload = {
  gameId: number
  moveNumber: number
  from: string
  to: string
  san: string
  fenAfterMove: string
  gameResult: 'white' | 'black' | 'draw' | null
}

export type PersistMoveResult = {
  ok: boolean
}

export type StartGamePayload = {
  createdByUserId: number
  creatorColor: 'white' | 'black' | 'random'
}

export type StartGameResult = {
  message: string
  game: {
    gameId: number
    whiteUsername: string
    blackUsername: string
    status: string
    playerColor: 'white' | 'black'
    opponentUsername: string
  }
  inviteCode?: string
}

export type PersistedMove = {
  move_number: number
  notation: string
  time: string | number | null
}

export type GetGameMovesResult = {
  gameId: number
  moves: PersistedMove[]
}

export type OpenSiteGame = {
  game_id: number
  invite_code: string
  game_time: number
  status: string
  creator_username: string
}

export type GetOpenGamesResult = {
  games: OpenSiteGame[]
}

export type JoinGamePayload = {
  userId: number
  inviteCode: string
}

export type ActiveGameResult = {
  game: {
    gameId: number
    whiteUsername: string
    blackUsername: string
    status: string
    playerColor: 'white' | 'black'
    opponentUsername: string
  } | null
}

export type HistoricalGame = {
  game_id: number
  result: string | null
  time_control: string | null
  white_famous_player: string
  black_famous_player: string
  context: string | null
}

export type HistoricalGamesResult = {
  games: HistoricalGame[]
}

export type UserFinishedGame = {
  game_id: number
  status: string
  result: string | null
  time_control: string | null
  your_color: 'white' | 'black'
  opponent_username: string
}

export type UserGameHistoryResult = {
  games: UserFinishedGame[]
}

export type UploadedGameRow = {
  game_id: number
  result: string | null
  time_control: string | null
  user_color: 'white' | 'black'
  opponent_name: string
  context: string | null
  uploaded_at: string
}

export type UploadedGamesListResult = {
  games: UploadedGameRow[]
}

export type ImportPgnPayload = {
  userId: number
  userColor: 'white' | 'black'
  pgnText: string
}

export type ImportPgnResult = {
  message: string
  imported: number
  games: { gameId: number; white: string; black: string }[]
}
