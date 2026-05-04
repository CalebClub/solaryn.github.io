(function () {
  "use strict";

  var STAFF_KEY = "solaryn_staff_records";
  var AUDIT_KEY = "solaryn_audit_log";
  var PASSWORD_LENGTH = 20;
  var ROTATE_AFTER_DAYS = 30;
  var CHALLENGE_EXPIRE_HOURS = 72;
  var UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  var LOWER = "abcdefghijkmnpqrstuvwxyz";
  var NUM = "23456789";
  var SYM = "!@#$%^&*()_-+=<>?";
  var CHALLENGE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function safeParse(raw, fallback) {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return fallback;
    }
  }

  function getStaff() {
    var staff = safeParse(localStorage.getItem(STAFF_KEY), []);
    var changed = false;
    var normalized = staff.map(function (record) {
      var migrated = normalizeRecord(record);
      if (JSON.stringify(migrated) !== JSON.stringify(record)) {
        changed = true;
      }
      return migrated;
    });
    if (changed) {
      saveStaff(normalized);
      addAudit("system.migrate", "Applied challenge-code defaults to legacy records.");
    }
    return normalized;
  }

  function saveStaff(staff) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  }

  function getAudit() {
    return safeParse(localStorage.getItem(AUDIT_KEY), []);
  }

  function addAudit(action, details) {
    var audit = getAudit();
    audit.unshift({
      id: crypto.randomUUID(),
      action: action,
      details: details,
      at: new Date().toISOString(),
    });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 400)));
  }

  function randInt(max) {
    var bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] % max;
  }

  function randomChar(chars) {
    return chars.charAt(randInt(chars.length));
  }

  function shuffle(str) {
    var arr = str.split("");
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = randInt(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.join("");
  }

  function generatePassword() {
    var pieces = [
      randomChar(UPPER),
      randomChar(UPPER),
      randomChar(LOWER),
      randomChar(LOWER),
      randomChar(NUM),
      randomChar(NUM),
      randomChar(SYM),
      randomChar(SYM),
    ];
    var pool = UPPER + LOWER + NUM + SYM;
    while (pieces.length < PASSWORD_LENGTH) {
      pieces.push(randomChar(pool));
    }
    return shuffle(pieces.join(""));
  }

  function generateChallengeCode() {
    var out = [];
    var i;
    for (i = 0; i < 16; i += 1) {
      out.push(randomChar(CHALLENGE));
    }
    return out.join("").replace(/(.{4})/g, "$1-").slice(0, 19);
  }

  function addHours(iso, hours) {
    return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  function normalizeRecord(record) {
    var updatedAt = record.updatedAt || new Date().toISOString();
    var challenge = record.challengeCode || generateChallengeCode();
    var challengeExpiry = record.challengeExpiresAt || addHours(updatedAt, CHALLENGE_EXPIRE_HOURS);
    var lastRotatedAt = record.lastRotatedAt || updatedAt;
    return {
      id: record.id,
      username: record.username,
      position: record.position,
      password: record.password,
      challengeCode: challenge,
      challengeExpiresAt: challengeExpiry,
      lastRotatedAt: lastRotatedAt,
      status: record.status || "active",
      createdAt: record.createdAt || updatedAt,
      updatedAt: updatedAt,
    };
  }

  function addStaff(payload) {
    var staff = getStaff();
    var nowIso = new Date().toISOString();
    var record = {
      id: crypto.randomUUID(),
      username: payload.username,
      position: payload.position,
      password: payload.password,
      challengeCode: payload.challengeCode || generateChallengeCode(),
      challengeExpiresAt: addHours(nowIso, CHALLENGE_EXPIRE_HOURS),
      lastRotatedAt: nowIso,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    staff.push(record);
    saveStaff(staff);
    addAudit("staff.create", "Created record for " + payload.username + " with challenge code.");
    return record;
  }

  function updateStaff(id, updates) {
    var staff = getStaff();
    var updated;
    var next = staff.map(function (record) {
      if (record.id !== id) {
        return record;
      }
      updated = {
        id: record.id,
        username: updates.username,
        position: updates.position,
        password: updates.password,
        challengeCode: updates.challengeCode || record.challengeCode,
        challengeExpiresAt: updates.challengeExpiresAt || record.challengeExpiresAt,
        lastRotatedAt: updates.lastRotatedAt || record.lastRotatedAt,
        status: updates.status || record.status,
        createdAt: record.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });

    if (!updated) {
      return null;
    }

    saveStaff(next);
    addAudit("staff.update", "Updated record for " + updated.username);
    return updated;
  }

  function removeStaff(id) {
    var staff = getStaff();
    var found = staff.find(function (row) {
      return row.id === id;
    });
    if (!found) {
      return false;
    }
    var next = staff.filter(function (row) {
      return row.id !== id;
    });
    saveStaff(next);
    addAudit("staff.delete", "Deleted record for " + found.username);
    return true;
  }

  function rotateStaffCredential(id) {
    var current = getStaff().find(function (row) {
      return row.id === id;
    });
    if (!current) {
      return null;
    }
    var nowIso = new Date().toISOString();
    var updated = updateStaff(id, {
      username: current.username,
      position: current.position,
      password: generatePassword(),
      challengeCode: generateChallengeCode(),
      challengeExpiresAt: addHours(nowIso, CHALLENGE_EXPIRE_HOURS),
      lastRotatedAt: nowIso,
      status: current.status,
    });
    addAudit("staff.rotate", "Rotated password and challenge for " + current.username);
    return updated;
  }

  function stringToBytes(str) {
    return new TextEncoder().encode(str);
  }

  function bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function bytesToBase64(bytes) {
    var binary = "";
    var i;
    for (i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    var i;
    for (i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function deriveKey(passphrase, salt) {
    return crypto.subtle
      .importKey("raw", stringToBytes(passphrase), "PBKDF2", false, ["deriveKey"])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: 220000,
            hash: "SHA-256",
          },
          baseKey,
          {
            name: "AES-GCM",
            length: 256,
          },
          false,
          ["encrypt", "decrypt"]
        );
      });
  }

  function exportEncrypted(passphrase) {
    var snapshot = {
      exportedAt: new Date().toISOString(),
      staff: getStaff(),
      audit: getAudit(),
      version: 1,
    };
    var plain = stringToBytes(JSON.stringify(snapshot));
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));

    return deriveKey(passphrase, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plain).then(function (cipher) {
        return JSON.stringify({
          alg: "AES-GCM",
          kdf: "PBKDF2-SHA256",
          iterations: 220000,
          salt: bytesToBase64(salt),
          iv: bytesToBase64(iv),
          data: bytesToBase64(new Uint8Array(cipher)),
        });
      });
    });
  }

  function importEncrypted(blobText, passphrase) {
    var payload = safeParse(blobText, null);
    if (!payload || !payload.salt || !payload.iv || !payload.data) {
      return Promise.reject(new Error("Invalid backup file format."));
    }
    var salt = base64ToBytes(payload.salt);
    var iv = base64ToBytes(payload.iv);
    var data = base64ToBytes(payload.data);

    return deriveKey(passphrase, salt).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data).then(function (plain) {
        var snapshot = safeParse(bytesToString(new Uint8Array(plain)), null);
        if (!snapshot || !Array.isArray(snapshot.staff) || !Array.isArray(snapshot.audit)) {
          throw new Error("Backup payload is missing required fields.");
        }
        saveStaff(snapshot.staff.map(normalizeRecord));
        localStorage.setItem(AUDIT_KEY, JSON.stringify(snapshot.audit.slice(0, 400)));
        addAudit("backup.import", "Imported encrypted backup file.");
        return {
          staff: snapshot.staff.length,
          audit: snapshot.audit.length,
        };
      });
    });
  }

  function getPolicy() {
    return {
      rotateAfterDays: ROTATE_AFTER_DAYS,
      challengeExpiresHours: CHALLENGE_EXPIRE_HOURS,
    };
  }

  window.SolarynStore = {
    getStaff: getStaff,
    addStaff: addStaff,
    updateStaff: updateStaff,
    removeStaff: removeStaff,
    rotateStaffCredential: rotateStaffCredential,
    getAudit: getAudit,
    addAudit: addAudit,
    getPolicy: getPolicy,
  };

  window.SolarynUtils = {
    generatePassword: generatePassword,
    generateChallengeCode: generateChallengeCode,
  };

  window.SolarynCrypto = {
    exportEncrypted: exportEncrypted,
    importEncrypted: importEncrypted,
  };
})();