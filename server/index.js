import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import mysql from 'mysql2/promise'
import { parseSinglePgnGame, splitPgnGames } from './pgnImport.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 4000)

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
}

if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH
}

if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  }
}

const pool = mysql.createPool(dbConfig)

async function finalizeSiteGame(connection, gameId, gameResult) {
  await connection.execute(
    "UPDATE Games SET status = 'completed', result = ? WHERE game_id = ?",
    [gameResult, gameId],
  )

  const [playerRows] = await connection.execute(
    'SELECT user_id, color, start_rating FROM Has WHERE game_id = ?',
    [gameId],
  )

  if (!Array.isArray(playerRows)) {
    return
  }

  for (const player of playerRows) {
    let ratingDelta = 0
    if (gameResult !== 'draw') {
      ratingDelta = player.color === gameResult ? 10 : -10
    }

    const endRating = Number(player.start_rating) + ratingDelta
    await connection.execute(
      'UPDATE Has SET end_rating = ? WHERE game_id = ? AND user_id = ?',
      [endRating, gameId, player.user_id],
    )

    await connection.execute(
      'UPDATE Users SET rating = ? WHERE user_id = ?',
      [endRating, player.user_id],
    )
  }
}

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true })
  } catch (error) {
    console.error('Health check failed:', error)
    response.status(500).json({ ok: false })
  }
})

app.post('/api/register', async (request, response) => {
  const { username, password } = request.body ?? {}

  if (!username || !password) {
    response.status(400).json({ message: 'Username and password are required.' })
    return
  }

  if (String(password).length < 8) {
    response.status(400).json({ message: 'Password must be at least 8 characters.' })
    return
  }

  try {
    const [existingRows] = await pool.execute(
      'SELECT user_id FROM Users WHERE username = ? LIMIT 1',
      [username],
    )

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      response.status(409).json({ message: 'Username already exists.' })
      return
    }

    const rating = 1200
    const passwordHash = await bcrypt.hash(password, 12)

    await pool.execute(
      'INSERT INTO Users (username, password, created_at, last_login, rating) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)',
      [username, passwordHash, rating],
    )

    response.status(201).json({ message: 'Account created successfully.' })
  } catch (error) {
    console.error('Register request failed:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_NO_SUCH_TABLE') {
      response.status(500).json({
        message:
          'The Users table does not exist yet. Create it before calling this endpoint.',
      })
      return
    }

    response.status(500).json({ message: 'Server error while creating account.' })
  }
})

app.post('/api/login', async (request, response) => {
  const { username, password } = request.body ?? {}
  if (!username || !password) {
    response.status(400).json({ message: 'Username and password are required.' })
    return
  }

  try {
    const [existingRows] = await pool.execute(
      'SELECT user_id, username, password FROM Users WHERE username = ? LIMIT 1',
      [username],
    )
    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      response.status(401).json({ message: 'Invalid username or password.' })
      return
    }

    const user = existingRows[0]
    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      response.status(401).json({ message: 'Invalid username or password.' })
      return
    }

    await pool.execute(
      'UPDATE Users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?',
      [user.user_id],
    )
    console.log(`User ${username} logged in successfully.`)
    response.json({
      message: 'Login successful.',
      user: {
        userId: user.user_id,
        username: user.username,
      },
    })
  } catch (error) {
    console.error('Login request failed:', error)
    response.status(500).json({ message: 'Server error while logging in.' })
  }
})

app.post('/api/games/start', async (request, response) => {
  const { createdByUserId, creatorColor } = request.body ?? {}
  if (!createdByUserId) {
    response.status(400).json({ message: 'createdByUserId is required.' })
    return
  }
  if (creatorColor && !['white', 'black', 'random'].includes(String(creatorColor))) {
    response.status(400).json({ message: 'creatorColor must be white, black, or random.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [creatorRows] = await connection.execute(
      'SELECT user_id, username, rating FROM Users WHERE user_id = ? LIMIT 1',
      [createdByUserId],
    )
    if (!Array.isArray(creatorRows) || creatorRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Creator account not found.' })
      return
    }

    const creator = creatorRows[0]
    const [activeGameRows] = await connection.execute(
      "SELECT g.game_id FROM Games g JOIN Has h ON g.game_id = h.game_id WHERE h.user_id = ? AND g.status IN ('waiting', 'in_progress') LIMIT 1",
      [creator.user_id],
    )
    if (Array.isArray(activeGameRows) && activeGameRows.length > 0) {
      await connection.rollback()
      response.status(409).json({ message: 'You are already in an active game.' })
      return
    }

    const chosenColor = String(creatorColor ?? 'random')
    const assignedCreatorColor =
      chosenColor === 'random'
        ? Math.random() < 0.5
          ? 'white'
          : 'black'
        : chosenColor
    const inviteCodeSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const inviteCode = `LOCAL${inviteCodeSuffix.slice(-12)}`
    const gameTimeInSeconds = 600

    const [gamesInsertResult] = await connection.execute(
      'INSERT INTO Games (created_by, status, result, time_control, is_rated) VALUES (?, ?, ?, ?, ?)',
      [creator.user_id, 'waiting', null, '10+0', false],
    )
    const gameId = Number(gamesInsertResult.insertId)
    if (!Number.isFinite(gameId) || gameId <= 0) {
      throw new Error('Could not determine game_id for new game.')
    }

    await connection.execute(
      'INSERT INTO SiteGame (game_id, invite_code, game_time) VALUES (?, ?, ?)',
      [gameId, inviteCode, gameTimeInSeconds],
    )

    await connection.execute(
      'INSERT INTO Has (game_id, user_id, color, start_rating, end_rating) VALUES (?, ?, ?, ?, ?)',
      [
        gameId,
        creator.user_id,
        assignedCreatorColor,
        creator.rating,
        null,
      ],
    )

    await connection.commit()
    response.status(201).json({
      message: 'Open game created.',
      game: {
        gameId,
        whiteUsername:
          assignedCreatorColor === 'white' ? creator.username : 'Waiting for opponent',
        blackUsername:
          assignedCreatorColor === 'black' ? creator.username : 'Waiting for opponent',
        status: 'waiting',
        playerColor: assignedCreatorColor,
        opponentUsername: 'Waiting for opponent',
      },
      inviteCode,
    })
  } catch (error) {
    await connection.rollback()
    console.error('Start game request failed:', error)
    response.status(500).json({ message: 'Server error while starting game.' })
  } finally {
    connection.release()
  }
})

app.get('/api/games/open', async (_request, response) => {
  try {
    const [rows] = await pool.execute(
      "SELECT sg.game_id, sg.invite_code, sg.game_time, g.status, u.username AS creator_username FROM SiteGame sg JOIN Games g ON sg.game_id = g.game_id JOIN Users u ON g.created_by = u.user_id WHERE g.status = 'waiting' ORDER BY sg.game_id DESC",
    )

    response.json({
      games: Array.isArray(rows) ? rows : [],
    })
  } catch (error) {
    console.error('Open games request failed:', error)
    response.status(500).json({ message: 'Server error while loading open games.' })
  }
})

app.get('/api/historical-games', async (_request, response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT g.game_id, g.result, g.time_control, hg.white_famous_player, hg.black_famous_player, hg.context FROM Games g JOIN HistoricalGame hg ON g.game_id = hg.game_id ORDER BY g.game_id ASC',
    )

    response.json({
      games: Array.isArray(rows) ? rows : [],
    })
  } catch (error) {
    console.error('Historical games request failed:', error)
    response.status(500).json({ message: 'Server error while loading historical games.' })
  }
})

app.post('/api/games/join', async (request, response) => {
  const { userId, inviteCode } = request.body ?? {}
  if (!userId || !inviteCode) {
    response.status(400).json({ message: 'userId and inviteCode are required.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [joinerRows] = await connection.execute(
      'SELECT user_id, username, rating FROM Users WHERE user_id = ? LIMIT 1',
      [userId],
    )
    if (!Array.isArray(joinerRows) || joinerRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Joining account not found.' })
      return
    }
    const joiner = joinerRows[0]
    const [joinerActiveGameRows] = await connection.execute(
      "SELECT g.game_id FROM Games g JOIN Has h ON g.game_id = h.game_id WHERE h.user_id = ? AND g.status IN ('waiting', 'in_progress') LIMIT 1",
      [joiner.user_id],
    )
    if (Array.isArray(joinerActiveGameRows) && joinerActiveGameRows.length > 0) {
      await connection.rollback()
      response.status(409).json({ message: 'You are already in an active game.' })
      return
    }

    const [openGameRows] = await connection.execute(
      "SELECT sg.game_id, g.created_by FROM SiteGame sg JOIN Games g ON sg.game_id = g.game_id WHERE sg.invite_code = ? AND g.status = 'waiting' LIMIT 1 FOR UPDATE",
      [inviteCode],
    )
    if (!Array.isArray(openGameRows) || openGameRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Open game for this invite code was not found.' })
      return
    }

    const openGame = openGameRows[0]
    if (Number(openGame.created_by) === Number(joiner.user_id)) {
      await connection.rollback()
      response.status(400).json({ message: 'You cannot join your own game.' })
      return
    }

    const [playerRows] = await connection.execute(
      'SELECT user_id, color FROM Has WHERE game_id = ? FOR UPDATE',
      [openGame.game_id],
    )
    if (!Array.isArray(playerRows) || playerRows.length === 0) {
      await connection.rollback()
      response.status(500).json({ message: 'Game players are not initialized correctly.' })
      return
    }

    const creatorPlayer = playerRows.find(
      (player) => Number(player.user_id) === Number(openGame.created_by),
    )
    if (!creatorPlayer) {
      await connection.rollback()
      response.status(500).json({ message: 'Creator player row could not be found.' })
      return
    }
    const joinerColor = creatorPlayer.color === 'white' ? 'black' : 'white'

    await connection.execute(
      'INSERT INTO Has (game_id, user_id, color, start_rating, end_rating) VALUES (?, ?, ?, ?, ?)',
      [openGame.game_id, joiner.user_id, joinerColor, joiner.rating, null],
    )

    await connection.execute(
      "UPDATE Games SET status = 'in_progress' WHERE game_id = ?",
      [openGame.game_id],
    )

    const [creatorRows] = await connection.execute(
      'SELECT username FROM Users WHERE user_id = ? LIMIT 1',
      [openGame.created_by],
    )
    const creatorUsername =
      Array.isArray(creatorRows) && creatorRows.length > 0 ? creatorRows[0].username : 'Creator'

    const whiteUsername = creatorPlayer.color === 'white' ? creatorUsername : joiner.username
    const blackUsername = creatorPlayer.color === 'white' ? joiner.username : creatorUsername

    await connection.commit()
    response.json({
      message: 'Game joined.',
      game: {
        gameId: Number(openGame.game_id),
        whiteUsername,
        blackUsername,
        status: 'in_progress',
        playerColor: joinerColor,
        opponentUsername: creatorUsername,
      },
    })
  } catch (error) {
    await connection.rollback()
    console.error('Join game request failed:', error)
    response.status(500).json({ message: 'Server error while joining game.' })
  } finally {
    connection.release()
  }
})

app.get('/api/games/active/:userId', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [activeRows] = await pool.execute(
      "SELECT g.game_id, g.status FROM Games g JOIN Has h ON g.game_id = h.game_id WHERE h.user_id = ? AND g.status IN ('waiting', 'in_progress') ORDER BY g.game_id DESC LIMIT 1",
      [userId],
    )

    if (!Array.isArray(activeRows) || activeRows.length === 0) {
      response.json({ game: null })
      return
    }

    const activeGame = activeRows[0]
    const [playersRows] = await pool.execute(
      'SELECT h.user_id, h.color, u.username FROM Has h JOIN Users u ON h.user_id = u.user_id WHERE h.game_id = ?',
      [activeGame.game_id],
    )

    const players = Array.isArray(playersRows) ? playersRows : []
    const whitePlayer = players.find((player) => player.color === 'white')
    const blackPlayer = players.find((player) => player.color === 'black')
    const currentPlayerById = players.find(
      (player) => Number(player.user_id) === Number(userId),
    )
    const currentPlayerColor =
      currentPlayerById?.color === 'black' ? 'black' : 'white'
    const opponentUsername =
      players.find((player) => Number(player.user_id) !== Number(userId))?.username ??
      'Waiting for opponent'

    response.json({
      game: {
        gameId: Number(activeGame.game_id),
        whiteUsername: whitePlayer?.username ?? 'Waiting for opponent',
        blackUsername: blackPlayer?.username ?? 'Waiting for opponent',
        status: String(activeGame.status),
        playerColor: currentPlayerColor,
        opponentUsername,
      },
    })
  } catch (error) {
    console.error('Active game request failed:', error)
    response.status(500).json({ message: 'Server error while loading active game.' })
  }
})

app.post('/api/games/resign', async (request, response) => {
  const { gameId, userId } = request.body ?? {}
  if (!gameId || !userId) {
    response.status(400).json({ message: 'gameId and userId are required.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [gameRows] = await connection.execute(
      "SELECT game_id, status FROM Games WHERE game_id = ? FOR UPDATE",
      [gameId],
    )
    if (!Array.isArray(gameRows) || gameRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Game not found.' })
      return
    }

    const game = gameRows[0]
    if (String(game.status) !== 'in_progress') {
      await connection.rollback()
      response.status(400).json({ message: 'Only in-progress games can be resigned.' })
      return
    }

    const [resignerRows] = await connection.execute(
      'SELECT color FROM Has WHERE game_id = ? AND user_id = ? LIMIT 1',
      [gameId, userId],
    )
    if (!Array.isArray(resignerRows) || resignerRows.length === 0) {
      await connection.rollback()
      response.status(403).json({ message: 'User is not a player in this game.' })
      return
    }

    const resignerColor = String(resignerRows[0].color)
    const winnerColor = resignerColor === 'white' ? 'black' : 'white'

    await finalizeSiteGame(connection, Number(gameId), winnerColor)

    await connection.commit()
    response.json({
      ok: true,
      message: `${winnerColor} wins by resignation.`,
      result: winnerColor,
    })
  } catch (error) {
    await connection.rollback()
    console.error('Resign request failed:', error)
    response.status(500).json({ message: 'Server error while resigning game.' })
  } finally {
    connection.release()
  }
})

app.post('/api/games/move', async (request, response) => {
  const { gameId, moveNumber, from, to, san, fenAfterMove, gameResult } = request.body ?? {}

  if (
    !gameId ||
    typeof moveNumber !== 'number' ||
    !from ||
    !to ||
    !san ||
    !fenAfterMove
  ) {
    response.status(400).json({
      message: 'gameId, moveNumber, from, to, san, and fenAfterMove are required.',
    })
    return
  }

  const squarePattern = /^[a-h][1-8]$/
  if (!squarePattern.test(String(from)) || !squarePattern.test(String(to))) {
    response.status(400).json({ message: 'Invalid move squares.' })
    return
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [gameRows] = await connection.execute(
      'SELECT game_id FROM Games WHERE game_id = ? FOR UPDATE',
      [gameId],
    )
    if (!Array.isArray(gameRows) || gameRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Game not found.' })
      return
    }

    const [lastMoveRows] = await connection.execute(
      'SELECT COALESCE(MAX(move_number), 0) AS lastMoveNumber FROM Moves WHERE game_id = ? FOR UPDATE',
      [gameId],
    )
    const lastMoveNumber =
      Array.isArray(lastMoveRows) && lastMoveRows.length > 0
        ? Number(lastMoveRows[0].lastMoveNumber ?? 0)
        : 0
    const nextMoveNumber = lastMoveNumber + 1

    await connection.execute(
      'INSERT INTO Moves (game_id, move_number, notation, time) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [gameId, nextMoveNumber, san],
    )

    if (gameResult === 'white' || gameResult === 'black' || gameResult === 'draw') {
      await finalizeSiteGame(connection, Number(gameId), gameResult)
    } else {
      await connection.execute(
        "UPDATE Games SET status = 'in_progress' WHERE game_id = ?",
        [gameId],
      )
    }

    await connection.commit()
    response.status(202).json({
      ok: true,
      message: 'Move saved.',
      fenAfterMove,
    })
  } catch (error) {
    await connection.rollback()
    console.error('Move update request failed:', error)
    response.status(500).json({ message: 'Server error while processing move.' })
  } finally {
    connection.release()
  }
})

app.post('/api/users/:userId/deleteFavoriteOpening', async (request, response) => {
  const userId = Number(request.params.userId)
  const { openingName } = request.body ?? {}
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }
  if (!openingName || String(openingName).trim().length === 0) {
    response.status(400).json({ message: 'openingName is required.' })
    return
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM UserFavoriteOpenings WHERE user_id = ? AND opening_name = ?',
      [userId, String(openingName).trim()],
    )
    response.json({ message: 'Favorite opening removed successfully.' })
  } catch (error) {
    console.error('Delete favorite opening failed:', error)
    response.status(500).json({ message: 'Server error while removing favorite opening.' })
  }
})

app.post('/api/users/:userId/addFavoriteOpening', async (request, response) => {
  const userId = Number(request.params.userId)
  const { openingName } = request.body ?? {}
  console.log(`Add favorite opening request: userId=${userId}, openingName=${openingName}`)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }
  if (!openingName || String(openingName).trim().length === 0) {
    response.status(400).json({ message: 'openingName is required.' })
    return 
  }

  try {
    await pool.execute(
      'INSERT INTO UserFavoriteOpenings (user_id, opening_name) VALUES (?, ?)',
      [userId, String(openingName).trim()]
    )
    response.json({ message: 'Favorite opening added successfully.' })
  } catch (error) {
    console.error('Add favorite opening failed:', error)
    response.status(500).json({ message: 'Server error while adding favorite opening.' })
  }
})

app.post('/api/users/:userId/change-password', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  const { currentPassword, newPassword } = request.body ?? {}
  if (!currentPassword || !newPassword) {
    response.status(400).json({ message: 'Current and new password are required.' })
    return
  }

  if (String(newPassword).length < 8) {
    response.status(400).json({ message: 'New password must be at least 8 characters.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      'SELECT password FROM Users WHERE user_id = ? LIMIT 1',
      [userId],
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      response.status(404).json({ message: 'User not found.' })
      return
    }

    const passwordMatch = await bcrypt.compare(currentPassword, rows[0].password)
    if (!passwordMatch) {
      response.status(401).json({ message: 'Current password is incorrect.' })
      return
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await pool.execute('UPDATE Users SET password = ? WHERE user_id = ?', [newHash, userId])

    response.json({ message: 'Password updated successfully.' })
  } catch (error) {
    console.error('Change password request failed:', error)
    response.status(500).json({ message: 'Server error while changing password.' })
  }
})

app.get('/api/users/search', async (request, response) => {
  const { username, requesterId } = request.query
  if (!username || String(username).trim().length === 0) {
    response.status(400).json({ message: 'username query param is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      'SELECT user_id, username, rating FROM Users WHERE username LIKE ? AND user_id != ? LIMIT 10',
      [`%${String(username).trim()}%`, Number(requesterId) || 0],
    )
    response.json({ users: Array.isArray(rows) ? rows : [] })
  } catch (error) {
    console.error('User search failed:', error)
    response.status(500).json({ message: 'Server error while searching users.' })
  }
})

app.get('/api/friends/:userId', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.username, u.rating
       FROM FriendsWith f
       JOIN Users u ON u.user_id = f.friend_user_id
       WHERE f.user_id = ? AND f.status = 'accepted'`,
      [userId],
    )
    response.json({ friends: Array.isArray(rows) ? rows : [] })
  } catch (error) {
    console.error('Get friends failed:', error)
    response.status(500).json({ message: 'Server error while loading friends.' })
  }
})

app.get('/api/friends/:userId/pending', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.username, u.rating
       FROM FriendsWith f
       JOIN Users u ON u.user_id = f.user_id
       WHERE f.friend_user_id = ? AND f.status = 'pending'`,
      [userId],
    )
    response.json({ requests: Array.isArray(rows) ? rows : [] })
  } catch (error) {
    console.error('Get pending requests failed:', error)
    response.status(500).json({ message: 'Server error while loading friend requests.' })
  }
})

app.post('/api/friends/request', async (request, response) => {
  const { userId, friendUserId } = request.body ?? {}
  if (!userId || !friendUserId) {
    response.status(400).json({ message: 'userId and friendUserId are required.' })
    return
  }
  if (Number(userId) === Number(friendUserId)) {
    response.status(400).json({ message: 'You cannot send a friend request to yourself.' })
    return
  }

  try {
    const [existing] = await pool.execute(
      'SELECT status FROM FriendsWith WHERE user_id = ? AND friend_user_id = ?',
      [userId, friendUserId],
    )
    if (Array.isArray(existing) && existing.length > 0) {
      const status = existing[0].status
      if (status === 'accepted') {
        response.status(409).json({ message: 'You are already friends.' })
      } else if (status === 'pending') {
        response.status(409).json({ message: 'Friend request already sent.' })
      } else {
        response.status(409).json({ message: 'A friend request already exists.' })
      }
      return
    }

    await pool.execute(
      "INSERT INTO FriendsWith (user_id, friend_user_id, status) VALUES (?, ?, 'pending')",
      [userId, friendUserId],
    )
    response.status(201).json({ message: 'Friend request sent.' })
  } catch (error) {
    console.error('Send friend request failed:', error)
    response.status(500).json({ message: 'Server error while sending friend request.' })
  }
})

app.post('/api/friends/accept', async (request, response) => {
  const { userId, friendUserId } = request.body ?? {}
  if (!userId || !friendUserId) {
    response.status(400).json({ message: 'userId and friendUserId are required.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      "UPDATE FriendsWith SET status = 'accepted' WHERE user_id = ? AND friend_user_id = ? AND status = 'pending'",
      [friendUserId, userId],
    )
    if (result.affectedRows === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Pending friend request not found.' })
      return
    }

    await connection.execute(
      "INSERT INTO FriendsWith (user_id, friend_user_id, status) VALUES (?, ?, 'accepted')",
      [userId, friendUserId],
    )

    await connection.commit()
    response.json({ message: 'Friend request accepted.' })
  } catch (error) {
    await connection.rollback()
    console.error('Accept friend request failed:', error)
    response.status(500).json({ message: 'Server error while accepting friend request.' })
  } finally {
    connection.release()
  }
})

app.post('/api/friends/remove', async (request, response) => {
  const { userId, friendUserId } = request.body ?? {}
  if (!userId || !friendUserId) {
    response.status(400).json({ message: 'userId and friendUserId are required.' })
    return
  }

  try {
    await pool.execute(
      'DELETE FROM FriendsWith WHERE (user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)',
      [userId, friendUserId, friendUserId, userId],
    )
    response.json({ message: 'Friend removed.' })
  } catch (error) {
    console.error('Remove friend failed:', error)
    response.status(500).json({ message: 'Server error while removing friend.' })
  }
})

app.post('/api/friends/reject', async (request, response) => {
  const { userId, friendUserId } = request.body ?? {}
  if (!userId || !friendUserId) {
    response.status(400).json({ message: 'userId and friendUserId are required.' })
    return
  }

  try {
    const [result] = await pool.execute(
      "UPDATE FriendsWith SET status = 'rejected' WHERE user_id = ? AND friend_user_id = ? AND status = 'pending'",
      [friendUserId, userId],
    )
    if (result.affectedRows === 0) {
      response.status(404).json({ message: 'Pending friend request not found.' })
      return
    }
    response.json({ message: 'Friend request declined.' })
  } catch (error) {
    console.error('Reject friend request failed:', error)
    response.status(500).json({ message: 'Server error while declining friend request.' })
  }
})

function truncateForDb(value, maxLength) {
  if (value == null || value === '') {
    return null
  }
  const s = String(value).trim()
  if (s.length === 0) {
    return null
  }
  if (s.length <= maxLength) {
    return s
  }
  return `${s.slice(0, Math.max(0, maxLength - 1))}…`
}

app.post('/api/uploads/pgn', async (request, response) => {
  const { userId, userColor, pgnText } = request.body ?? {}
  const uid = Number(userId)
  if (!Number.isFinite(uid) || uid <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }
  if (userColor !== 'white' && userColor !== 'black') {
    response.status(400).json({ message: 'userColor must be "white" or "black".' })
    return
  }
  if (!pgnText || typeof pgnText !== 'string' || pgnText.trim().length === 0) {
    response.status(400).json({ message: 'pgnText is required.' })
    return
  }

  const chunks = splitPgnGames(pgnText)
  if (chunks.length === 0) {
    response.status(400).json({ message: 'No PGN games found in file.' })
    return
  }

  const parsedGames = []
  for (let i = 0; i < chunks.length; i++) {
    try {
      parsedGames.push(parseSinglePgnGame(chunks[i]))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Invalid PGN.'
      response.status(400).json({
        message: `Could not parse game ${i + 1} of ${chunks.length}: ${reason}`,
      })
      return
    }
  }

  try {
    const [userRows] = await pool.execute('SELECT user_id FROM Users WHERE user_id = ? LIMIT 1', [uid])
    if (!Array.isArray(userRows) || userRows.length === 0) {
      response.status(404).json({ message: 'User not found.' })
      return
    }
  } catch (error) {
    console.error('PGN upload user lookup failed:', error)
    response.status(500).json({ message: 'Server error while validating user.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const created = []

    for (const game of parsedGames) {
      const opponentFromPgn = userColor === 'white' ? game.black : game.white
      const opponentName = truncateForDb(opponentFromPgn, 100) ?? 'Unknown'
      const contextValue = truncateForDb(game.context, 255)

      const timeControlValue = truncateForDb(game.timeControl, 30)

      const [gamesInsertResult] = await connection.execute(
        'INSERT INTO Games (created_by, status, result, time_control, is_rated) VALUES (?, ?, ?, ?, ?)',
        [uid, 'completed', game.result, timeControlValue, false],
      )
      const gameId = Number(gamesInsertResult.insertId)
      if (!Number.isFinite(gameId) || gameId <= 0) {
        throw new Error('Could not determine game_id after insert.')
      }

      await connection.execute(
        'INSERT INTO UploadedGame (game_id, uploaded_by, uploaded_at, opponent_name, context, user_color) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)',
        [gameId, uid, opponentName, contextValue, userColor],
      )

      let moveNumber = 0
      for (const san of game.sans) {
        moveNumber += 1
        await connection.execute(
          'INSERT INTO Moves (game_id, move_number, notation, time) VALUES (?, ?, ?, NULL)',
          [gameId, moveNumber, san],
        )
      }

      created.push({
        gameId,
        white: game.white,
        black: game.black,
      })
    }

    await connection.commit()
    response.status(201).json({
      message: `Imported ${created.length} game(s).`,
      imported: created.length,
      games: created,
    })
  } catch (error) {
    await connection.rollback()
    console.error('PGN upload failed:', error)
    response.status(500).json({ message: 'Server error while importing PGN.' })
  } finally {
    connection.release()
  }
})

app.get('/api/users/:userId/uploaded-games', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
        ug.game_id,
        g.result,
        g.time_control,
        ug.user_color,
        ug.opponent_name,
        ug.context,
        ug.uploaded_at
      FROM UploadedGame ug
      JOIN Games g ON g.game_id = ug.game_id
      WHERE ug.uploaded_by = ?
      ORDER BY ug.game_id DESC`,
      [userId],
    )

    response.json({
      games: Array.isArray(rows) ? rows : [],
    })
  } catch (error) {
    console.error('Uploaded games list failed:', error)
    response.status(500).json({ message: 'Server error while loading uploaded games.' })
  }
})

app.delete('/api/uploads/games/:gameId', async (request, response) => {
  const gameId = Number(request.params.gameId)
  const userId = Number(request.query.userId)
  if (!Number.isFinite(gameId) || gameId <= 0) {
    response.status(400).json({ message: 'A valid gameId is required.' })
    return
  }
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId query parameter is required.' })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const [ownRows] = await connection.execute(
      'SELECT game_id FROM UploadedGame WHERE game_id = ? AND uploaded_by = ? LIMIT 1 FOR UPDATE',
      [gameId, userId],
    )
    if (!Array.isArray(ownRows) || ownRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Uploaded game not found or not owned by this user.' })
      return
    }

    await connection.execute('DELETE FROM Moves WHERE game_id = ?', [gameId])
    await connection.execute('DELETE FROM UploadedGame WHERE game_id = ?', [gameId])
    await connection.execute('DELETE FROM Games WHERE game_id = ?', [gameId])

    await connection.commit()
    response.json({ ok: true, message: 'Game deleted.' })
  } catch (error) {
    await connection.rollback()
    console.error('Delete uploaded game failed:', error)
    response.status(500).json({ message: 'Server error while deleting game.' })
  } finally {
    connection.release()
  }
})

app.get('/api/users/:userId/game-history', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
        g.game_id,
        g.status,
        g.result,
        g.time_control,
        h_me.color AS your_color,
        COALESCE(opp.username, 'Unknown') AS opponent_username
      FROM Has h_me
      JOIN Games g ON g.game_id = h_me.game_id
      JOIN SiteGame sg ON sg.game_id = g.game_id
      LEFT JOIN Has h_opp ON h_opp.game_id = g.game_id AND h_opp.user_id <> h_me.user_id
      LEFT JOIN Users opp ON opp.user_id = h_opp.user_id
      WHERE h_me.user_id = ? AND g.status = 'completed'
      ORDER BY g.game_id DESC`,
      [userId],
    )

    response.json({
      games: Array.isArray(rows) ? rows : [],
    })
  } catch (error) {
    console.error('User game history request failed:', error)
    response.status(500).json({ message: 'Server error while loading game history.' })
  }
})

app.get('/api/users/:userId', async (request, response) => {
  const userId = Number(request.params.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    response.status(400).json({ message: 'A valid userId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      'SELECT username, created_at, rating FROM Users WHERE user_id = ? LIMIT 1',
      [userId],
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      response.status(404).json({ message: 'User not found.' })
      return
    }

    const user = rows[0]

    const [favoriteOpeningsRows] = await pool.execute(
      'SELECT opening_name FROM UserFavoriteOpenings WHERE user_id = ?',
      [userId],
    )
    const favoriteOpenings = Array.isArray(favoriteOpeningsRows)
      ? favoriteOpeningsRows.map((row) => row.opening_name)
      : []

    response.json({
      username: user.username,
      createdAt: user.created_at,
      rating: user.rating,
      favoriteOpenings,
    })
  } catch (error) {
    console.error('Get user request failed:', error)
    response.status(500).json({ message: 'Server error while loading user.' })
  }
})

app.get('/api/games/:gameId/moves', async (request, response) => {
  const gameId = Number(request.params.gameId)
  if (!Number.isFinite(gameId) || gameId <= 0) {
    response.status(400).json({ message: 'A valid gameId is required.' })
    return
  }

  try {
    const [rows] = await pool.execute(
      'SELECT move_number, notation, time FROM Moves WHERE game_id = ? ORDER BY move_number ASC',
      [gameId],
    )

    response.json({
      gameId,
      moves: Array.isArray(rows) ? rows : [],
    })
  } catch (error) {
    console.error('Get moves request failed:', error)
    response.status(500).json({ message: 'Server error while loading moves.' })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
