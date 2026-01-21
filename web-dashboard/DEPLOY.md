# Deploy Guide

## 1. Environment Variables
You MUST create a `.env` file in the project root on your deployment machine.
Copy the content from your local development `.env` (excluding sensitive local paths if any).

Example `.env`:
```
DB_HOST=your-postgres-host
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASS=your-db-pass
DB_PORT=5432
FLASK_APP=app.py

# Docker Ports (Internal & External)
FRONTEND_PORT=8080
BACKEND_PORT=5001
```

## 2. Docker
Run the following commands:

```bash
# 1. Build and start containers
# Note: Containers typically need to be rebuilt after changing environment variables that affect build args or entrypoints
docker-compose up --build -d

# 2. Initialize Database (Run only once on first deploy)
docker-compose exec backend python init_db.py
```

## 3. Verify
Check if services are running:
```bash
docker-compose ps
```

## 4. Troubleshooting: Empty Client ID
If Google Login fails with `origin_mismatch` and `client_id` is empty in Network requests:

1. **Verify Compose Resolution**:
   ```bash
   docker-compose config
   ```
   Ensure `REACT_APP_GOOGLE_CLIENT_ID` has a value under the frontend service.

2. **Force Build with Args (Windows PowerShell)**:
   ```bash
   $env:REACT_APP_GOOGLE_CLIENT_ID="your-id"
   docker-compose build --no-cache frontend
   docker-compose up -d frontend
   ```

3. **Check .env Location**:
   Ensure `.env` is in the same directory as `docker-compose.yml`.
