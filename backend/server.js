"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8787;
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "ADMINSOLARYNACCPETEDZEAO";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const DB_PATH = path.join(__dirname, "data", "staff-db.json");

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const NUM = "23456789";
const SYM = "!@#$%^&*()_-+=<>?";
const CHALLENGE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const tokens = new Map();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function readDb() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.staff)) data.staff = [];
  if (!Array.isArray(data.audit)) data.audit = [];
  return data;
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addAudit(data, action, details) {
  data.audit.unshift({
    id: crypto.randomUUID(),
    action,
    details,
    at: new Date().toISOString(),
  });
  data.audit = data.audit.slice(0, 1000);
}

function normalizeStaffRow(input) {
  const now = new Date().toISOString();
  const updatedAt = String(input.updatedAt || now);
  const createdAt = String(input.createdAt || updatedAt);
  const lastRotatedAt = String(input.lastRotatedAt || updatedAt);
  const challengeExpiresAt = String(
    input.challengeExpiresAt || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
  );

  return {
    id: String(input.id || crypto.randomUUID()),
    username: String(input.username || "").trim(),
    position: String(input.position || "").trim(),
    password: String(input.password || generatePassword()),
    challengeCode: String(input.challengeCode || generateChallengeCode()),
    challengeExpiresAt,
    lastRotatedAt,
    status: String(input.status || "active"),
    createdAt,
    updatedAt,
  };
}

function normalizeAuditEntry(input) {
  return {
    id: String(input.id || crypto.randomUUID()),
    action: String(input.action || "system.event"),
    details: String(input.details || ""),
    at: String(input.at || new Date().toISOString()),
  };
}

function mergeById(currentItems, incomingItems) {
  const map = new Map();

  currentItems.forEach((item) => {
    map.set(item.id, item);
  });

  incomingItems.forEach((item) => {
    map.set(item.id, item);
  });

  return Array.from(map.values());
}

function randInt(max) {
  return crypto.randomInt(0, max);
}

function randomChar(chars) {
  return chars.charAt(randInt(chars.length));
}

function shuffle(str) {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1);
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr.join("");
}

function generatePassword() {
  const pieces = [
    randomChar(UPPER),
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(LOWER),
    randomChar(NUM),
    randomChar(NUM),
    randomChar(SYM),
    randomChar(SYM),
  ];
  const pool = UPPER + LOWER + NUM + SYM;
  while (pieces.length < 20) {
    pieces.push(randomChar(pool));
  }
  return shuffle(pieces.join(""));
}

function generateChallengeCode() {
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += randomChar(CHALLENGE);
  }
  return out.replace(/(.{4})/g, "$1-").slice(0, 19);
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expiresAt = tokens.get(token);
  if (!expiresAt || Date.now() > expiresAt) {
    if (token) tokens.delete(token);
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "solaryn-safety-backend" });
});

app.post("/api/login", (req, res) => {
  const candidate = String(req.body.masterPassword || "");
  if (candidate !== MASTER_PASSWORD) {
    res.status(401).json({ error: "Invalid master password" });
    return;
  }
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  res.json({ token, expiresInMs: TOKEN_TTL_MS });
});

app.get("/api/policy", requireAuth, (_req, res) => {
  res.json({
    passwordLength: 20,
    rotateAfterDays: 30,
    challengeExpiresHours: 72,
  });
});

app.get("/api/staff", requireAuth, (_req, res) => {
  const db = readDb();
  res.json({ staff: db.staff });
});

app.post("/api/staff", requireAuth, (req, res) => {
  const db = readDb();
  const username = String(req.body.username || "").trim();
  const position = String(req.body.position || "").trim();
  if (!username || !position) {
    res.status(400).json({ error: "username and position are required" });
    return;
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    username,
    position,
    password: String(req.body.password || generatePassword()),
    challengeCode: String(req.body.challengeCode || generateChallengeCode()),
    challengeExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    lastRotatedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  db.staff.push(row);
  addAudit(db, "staff.create", `Created ${row.username}`);
  writeDb(db);
  res.status(201).json(row);
});

app.put("/api/staff/:id", requireAuth, (req, res) => {
  const db = readDb();
  const row = db.staff.find((item) => item.id === req.params.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  row.username = String(req.body.username || row.username);
  row.position = String(req.body.position || row.position);
  row.password = String(req.body.password || row.password);
  row.challengeCode = String(req.body.challengeCode || row.challengeCode);
  row.challengeExpiresAt = String(req.body.challengeExpiresAt || row.challengeExpiresAt);
  row.lastRotatedAt = String(req.body.lastRotatedAt || row.lastRotatedAt);
  row.status = String(req.body.status || row.status);
  row.updatedAt = new Date().toISOString();

  addAudit(db, "staff.update", `Updated ${row.username}`);
  writeDb(db);
  res.json(row);
});

app.post("/api/staff/:id/rotate", requireAuth, (req, res) => {
  const db = readDb();
  const row = db.staff.find((item) => item.id === req.params.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const now = new Date().toISOString();
  row.password = generatePassword();
  row.challengeCode = generateChallengeCode();
  row.challengeExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  row.lastRotatedAt = now;
  row.updatedAt = now;

  addAudit(db, "staff.rotate", `Rotated credentials for ${row.username}`);
  writeDb(db);
  res.json(row);
});

app.delete("/api/staff/:id", requireAuth, (req, res) => {
  const db = readDb();
  const index = db.staff.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [removed] = db.staff.splice(index, 1);
  addAudit(db, "staff.delete", `Deleted ${removed.username}`);
  writeDb(db);
  res.json({ ok: true });
});

app.get("/api/audit", requireAuth, (_req, res) => {
  const db = readDb();
  res.json({ audit: db.audit });
});

app.post("/api/audit", requireAuth, (req, res) => {
  const action = String(req.body.action || "").trim();
  const details = String(req.body.details || "").trim();

  if (!action || !details) {
    res.status(400).json({ error: "action and details are required" });
    return;
  }

  const db = readDb();
  const entry = normalizeAuditEntry({ action, details });
  db.audit.unshift(entry);
  db.audit = db.audit.slice(0, 1000);
  writeDb(db);
  res.status(201).json(entry);
});

app.post("/api/import", requireAuth, (req, res) => {
  const incomingStaff = Array.isArray(req.body.staff) ? req.body.staff : [];
  const incomingAudit = Array.isArray(req.body.audit) ? req.body.audit : [];
  const replace = req.body.replace === true;

  const normalizedStaff = incomingStaff
    .map(normalizeStaffRow)
    .filter((row) => row.username && row.position);
  const normalizedAudit = incomingAudit.map(normalizeAuditEntry);

  const db = readDb();
  db.staff = replace ? normalizedStaff : mergeById(db.staff, normalizedStaff);
  db.audit = replace ? normalizedAudit : mergeById(db.audit, normalizedAudit);
  db.audit.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  addAudit(db, replace ? "backup.import" : "system.seed", replace ? "Imported snapshot into backend." : "Seeded backend from cached browser data.");
  writeDb(db);

  res.json({
    staff: db.staff,
    audit: db.audit,
  });
});

app.listen(PORT, () => {
  console.log(`Solaryn backend running on http://localhost:${PORT}`);
});
