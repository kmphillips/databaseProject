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
DB_NAME=chess-app
```
GETTING DB PROXY and Local dev TO WORK

1. Download Google Cloud CLI
2. Install with default settings
3. Login to Connected google account
4. Select correct project
5. Run "gcloud auth application-default login" in the google shell
6. From the project folder, start the proxy. In **PowerShell** the current directory is not on PATH, so use `.\`: `.\cloud-sql-proxy.exe cs4750db-492516:us-east4:chess-app-db --address 127.0.0.1 --port 3306`. In **cmd**, `cloud-sql-proxy.exe` with the same arguments is fine if you `cd` to this folder first.
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

## 4. Local vs GCP API Base URL

Frontend API calls use a shared helper (`src/config/api.ts`) and `VITE_API_BASE_URL`.

- Local development: do not set `VITE_API_BASE_URL` (or leave it empty). Requests stay as `/api/...` and Vite proxy handles routing to `http://127.0.0.1:4000`.
- Production: set `VITE_API_BASE_URL` to your deployed backend URL (for example, `https://chess-api-xxxxxx-ue.a.run.app`).

Example `.env` for local:

```env
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password_here
DB_NAME=chess_app
```

## 5. Deploy Backend to Cloud Run (GCP)

Use PowerShell syntax (backticks for multiline). Do not set `PORT` manually on Cloud Run.

```powershell
gcloud run deploy chess-api `
  --source . `
  --region us-east4 `
  --allow-unauthenticated `
  --set-env-vars "DB_USER=your_db_user,DB_PASSWORD=your_db_password,DB_NAME=chess_app,DB_SOCKET_PATH=/cloudsql/your-project:us-east4:your-instance" `
  --add-cloudsql-instances "your-project:us-east4:your-instance"
```

Get backend URL:

```powershell
gcloud run services describe chess-api --region us-east4 --format="value(status.url)"
```

Health check:

```bash
curl https://YOUR_CHESS_API_URL/api/health
```

## 6. Deploy Frontend to Cloud Run (GCP)

Create `Dockerfile.frontend` in the project root:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

Build and deploy:

```powershell
gcloud builds submit `
  --tag gcr.io/your-project/chess-web `
  --file Dockerfile.frontend `
  --build-arg VITE_API_BASE_URL=https://YOUR_CHESS_API_URL
```

```powershell
gcloud run deploy chess-web `
  --image gcr.io/your-project/chess-web `
  --region us-east4 `
  --allow-unauthenticated
```

Get frontend URL:

```powershell
gcloud run services describe chess-web --region us-east4 --format="value(status.url)"
```

Use the `chess-web` URL for demonstration to show the app is fully hosted on GCP.

## 7. User Awards (trigger-based)

This repo includes trigger-based award SQL at:

- `server/sql/user_awards.sql`

Run that script in Cloud SQL Studio after your base schema is created. It adds:

- `AwardDefinitions`
- `UserAwards`
- Stored procedures + triggers that grant awards when users:
  - play games (`1, 5, 10, 25, 50, 100`)
  - upload games (`1, 5, 10, 25, 50, 100`)
  - play moves (`100, 500, 1000, 10000`)

Profile and friend profile views automatically display awarded badges once these tables are active.
