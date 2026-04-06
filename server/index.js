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

    const rating = 1200
    const passwordHash = await bcrypt.hash(password, 12)

    await pool.execute(
      'INSERT INTO Users (username, password, rating, last_login) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
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

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
