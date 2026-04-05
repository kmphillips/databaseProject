import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import mysql from 'mysql2/promise'

dotenv.config()

const app = express()
const port = Number(process.env.PORT ?? 4000)

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true })
  } catch {
    response.status(500).json({ ok: false })
  }
})

app.post('/api/register', async (request, response) => {
  const { fullName, email, username, password } = request.body ?? {}

  if (!fullName || !email || !username || !password) {
    response.status(400).json({ message: 'All fields are required.' })
    return
  }

  if (String(password).length < 8) {
    response.status(400).json({ message: 'Password must be at least 8 characters.' })
    return
  }

  try {
    const [existingRows] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [email, username],
    )

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      response.status(409).json({ message: 'Email or username already exists.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await pool.execute(
      'INSERT INTO users (full_name, email, username, password_hash) VALUES (?, ?, ?, ?)',
      [fullName, email, username, passwordHash],
    )

    response.status(201).json({ message: 'Account created successfully.' })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_NO_SUCH_TABLE') {
      response.status(500).json({
        message:
          'The users table does not exist yet. Create it before calling this endpoint.',
      })
      return
    }

    response.status(500).json({ message: 'Server error while creating account.' })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
