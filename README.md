# Chess App Account Setup (MySQL, No ORM)

This project has:

- A React create-account page
- A Node/Express backend endpoint
- Raw SQL queries with `mysql2` (no ORM)

## 1. Configure Environment Variables

Edit `.env` in the project root:

```env
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password_here
DB_NAME=chess_app
```
GETTING DB PROXY and Local dev TO WORK

1. Download Google Cloud CLI
2. Install with default settings
3. Login to Connected google account
4. Select correct project
5. Run "gcloud auth application-default login" in the google shell
6. Run "cloud-sql-proxy.exe cs4750db-492516:us-east4:chess-app-db --address 127.0.0.1 --port 3306" in cmd in this project
7. Run "npm run dev" and "npm run dev:server" in cmd in this project
8. With proxy and those 2 you should be able to use app locally and connect to google DB



## 2. Create Database and Table

Run this SQL in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS chess_app;
USE chess_app;

CREATE TABLE IF NOT EXISTS Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rating INT NOT NULL DEFAULT 1200,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Run Backend and Frontend

Start backend:

```bash
npm run dev:server
```

In another terminal, start frontend:

```bash
npm run dev
```

The frontend submits to `/api/register`, which Vite proxies to `http://127.0.0.1:4000`.

## Raw SQL Used for Registration

The backend currently uses these parameterized queries:

```sql
SELECT user_id FROM Users WHERE username = ? LIMIT 1;
INSERT INTO Users (username, password, rating, last_login) VALUES (?, ?, ?, CURRENT_TIMESTAMP);
```

## If You See `http proxy error: /api/register` and `ECONNRESET`

This is usually a local process issue (backend restart/crash or proxy not reachable), not a frontend bug.

1. Verify backend is running on port 4000:

```bash
curl http://localhost:4000/api/health
```

2. Verify the endpoint directly (bypassing Vite proxy):

```bash
curl -X POST http://localhost:4000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

3. Restart all 3 local processes in this order:
- cloud-sql-proxy
- `npm run dev:server`
- `npm run dev`

4. Confirm the Cloud SQL proxy command includes `--address` exactly as shown above.
