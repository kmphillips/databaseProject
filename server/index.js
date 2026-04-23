import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import mysql from 'mysql2/promise'

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

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

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

    const userId = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`)
    const rating = 1200
    const passwordHash = await bcrypt.hash(password, 12)

    await pool.execute(
      'INSERT INTO Users (user_id, username, password, created_at, last_login, rating) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)',
      [userId, username, passwordHash, rating],
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
  const { createdByUserId, opponentUsername } = request.body ?? {}
  if (!createdByUserId || !opponentUsername) {
    response.status(400).json({ message: 'createdByUserId and opponentUsername are required.' })
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

    const [opponentRows] = await connection.execute(
      'SELECT user_id, username, rating FROM Users WHERE username = ? LIMIT 1',
      [opponentUsername],
    )
    if (!Array.isArray(opponentRows) || opponentRows.length === 0) {
      await connection.rollback()
      response.status(404).json({ message: 'Opponent user was not found.' })
      return
    }

    const creator = creatorRows[0]
    const opponent = opponentRows[0]
    if (creator.user_id === opponent.user_id) {
      await connection.rollback()
      response.status(400).json({ message: 'Choose another account as opponent.' })
      return
    }

    const gameId = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`)
    const inviteCode = `LOCAL${String(gameId).slice(-12)}`
    const gameTimeInSeconds = 600

    await connection.execute(
      'INSERT INTO Games (game_id, created_by, status, result, time_control, is_rated) VALUES (?, ?, ?, ?, ?, ?)',
      [gameId, creator.user_id, 'in_progress', null, '10+0', false],
    )

    await connection.execute(
      'INSERT INTO SiteGame (game_id, invite_code, game_time) VALUES (?, ?, ?)',
      [gameId, inviteCode, gameTimeInSeconds],
    )

    await connection.execute(
      'INSERT INTO Has (game_id, user_id, color, start_rating, end_rating) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      [
        gameId,
        creator.user_id,
        'white',
        creator.rating,
        null,
        gameId,
        opponent.user_id,
        'black',
        opponent.rating,
        null,
      ],
    )

    await connection.commit()
    response.status(201).json({
      message: 'Game started.',
      game: {
        gameId,
        whiteUsername: creator.username,
        blackUsername: opponent.username,
      },
    })
  } catch (error) {
    await connection.rollback()
    console.error('Start game request failed:', error)
    response.status(500).json({ message: 'Server error while starting game.' })
  } finally {
    connection.release()
  }
})

app.post('/api/games/move', async (request, response) => {
  const { gameId, moveNumber, from, to, san, fenAfterMove } = request.body ?? {}

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

    await connection.execute(
      "UPDATE Games SET status = 'in_progress' WHERE game_id = ?",
      [gameId],
    )

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

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
