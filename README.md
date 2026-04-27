LOCAL DEV

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


