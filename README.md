# solaryn.github.io

Solaryn staff safety vault for Minecraft/Discord team identity verification.

## Features
- Master-password protected access for all management pages
- 20-character complex password generator
- Staff table with username, position, password, and challenge code
- Quick update controls for username, position, password, and status
- Per-staff challenge codes with credential rotation controls
- Encrypted export/import backup workflow
- Audit trail for all credential actions

## GitHub Pages
This repository is already named for user pages. Pushing to `main` publishes static frontend files.

Site entry point: `index.html`

## Optional Backend API
An optional server-side API is included in `backend/` for stronger deployments.

```bash
cd backend
npm install
MASTER_PASSWORD='ADMINSOLARYNACCPETEDZEAO' npm start
```

Note: GitHub Pages does not run Node.js servers. Host `backend/` on a server platform if you want server-side security.

If you deploy the backend to Railway, set the service root directory to `backend`, add `MASTER_PASSWORD` in Railway variables, deploy, then enter the Railway URL on the login page `Backend URL` field.