# Solaryn Backend API

This optional backend provides server-side credential storage and API authentication.

## Why this exists
GitHub Pages can only host static files. This backend is for stronger security in real deployment environments (VPS, Render, Railway, etc.).

## Quick start

```bash
cd backend
npm install
MASTER_PASSWORD='ADMINSOLARYNACCPETEDZEAO' npm start
```

Server runs on `http://localhost:8787` by default.

## Railway setup

1. Push this repo to GitHub.
2. In Railway, create a new project and choose `Deploy from GitHub repo`.
3. Select this repository.
4. In the Railway service settings, set the root directory to `backend`.
5. Railway should detect Node automatically. The start command can stay as `npm start`.
6. Add an environment variable named `MASTER_PASSWORD` with your real vault password.
7. Deploy the service.
8. After deploy, open the generated Railway domain, then visit `/api/health` and confirm it returns `{"ok":true,...}`.
9. Open your GitHub Pages frontend, paste the Railway URL into the `Backend URL` field on the login page, and sign in.

Example backend URL:

```text
https://your-service-name.up.railway.app
```

Notes:
- The backend database is stored in `backend/data/staff-db.json` inside the running service.
- The backend code reads that file from `__dirname/data/staff-db.json`, so on Railway the volume should be mounted at `/app/data`.
- If Railway restarts or redeploys without a persistent volume, that JSON file can reset.
- For production use, add a Railway volume mounted to `/app/data` so `staff-db.json` survives redeploys.
- If you later move to Postgres or another hosted database, this API layer is the place to swap storage.

## Endpoints
- `POST /api/login`
- `GET /api/policy`
- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `POST /api/staff/:id/rotate`
- `DELETE /api/staff/:id`
- `GET /api/audit`
- `POST /api/audit`
- `POST /api/import`

Use `Authorization: Bearer <token>` for protected routes.
