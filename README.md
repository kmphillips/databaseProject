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
6. run "cloud-sql-proxy.exe cs4750db-492516:us-east4:chess-app-db address 127.0.0.1 --port 3306" in cmd in this project
7. Run "npm run dev" and "npm run dev:server" in cmd in this project
8. With proxy and those 2 you should be able to use app locally and connect to google DB



## 2. Create Database and Table

Run this SQL in MySQL:

```sql
CREATE DATABASE IF NOT EXISTS chess_app;
USE chess_app;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

The frontend submits to `/api/register`, which Vite proxies to `http://localhost:4000`.

## Raw SQL Used for Registration

The backend currently uses these parameterized queries:

```sql
SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1;
INSERT INTO users (full_name, email, username, password_hash) VALUES (?, ?, ?, ?);
```
