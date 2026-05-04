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

## Endpoints
- `POST /api/login`
- `GET /api/policy`
- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`
- `POST /api/staff/:id/rotate`
- `DELETE /api/staff/:id`
- `GET /api/audit`

Use `Authorization: Bearer <token>` for protected routes.
