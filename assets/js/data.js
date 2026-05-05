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
  var remoteBootstrapPromise = null;

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

  function hasBackendAccess() {
    return Boolean(window.SolarynAPI && window.SolarynAPI.getToken());
  }

  function readCachedStaff() {
    return safeParse(localStorage.getItem(STAFF_KEY), []).map(normalizeRecord);
  }

  function writeCachedStaff(staff) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff.map(normalizeRecord)));
  }

  function readCachedAudit() {
    return safeParse(localStorage.getItem(AUDIT_KEY), []);
  }

  function writeCachedAudit(audit) {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 400)));
  }

  function mergeAuditEntries(entries) {
    var seen = Object.create(null);
    return entries
      .filter(function (entry) {
        if (!entry || !entry.id || seen[entry.id]) {
          return false;
        }
        seen[entry.id] = true;
        return true;
      })
      .sort(function (left, right) {
        return new Date(right.at).getTime() - new Date(left.at).getTime();
      });
  }

  function saveStaff(staff) {
    writeCachedStaff(staff);
  }

  function cacheRemoteState(staff, audit) {
    var normalizedStaff = Array.isArray(staff) ? staff.map(normalizeRecord) : readCachedStaff();
    var normalizedAudit = Array.isArray(audit) ? mergeAuditEntries(audit) : readCachedAudit();

    if (Array.isArray(staff)) {
      writeCachedStaff(normalizedStaff);
    }
    if (Array.isArray(audit)) {
      writeCachedAudit(normalizedAudit);
    }

    return {
      staff: normalizedStaff,
      audit: normalizedAudit,
    };
  }

  function fetchRemoteState() {
    return Promise.all([
      window.SolarynAPI.getStaffFromBackend(),
      window.SolarynAPI.getAuditFromBackend(),
    ]).then(function (results) {
      return cacheRemoteState(results[0] || [], results[1] || []);
    });
  }

  function ensureRemoteState() {
    if (!hasBackendAccess()) {
      return Promise.resolve({
        staff: readCachedStaff(),
        audit: readCachedAudit(),
      });
    }

    if (remoteBootstrapPromise) {
      return remoteBootstrapPromise.then(function () {
        return fetchRemoteState().catch(function () {
          return {
            staff: readCachedStaff(),
            audit: readCachedAudit(),
          };
        });
      });
    }

    remoteBootstrapPromise = fetchRemoteState()
      .then(function (results) {
        var remoteStaff = results.staff;
        var remoteAudit = results.audit;
        var cachedStaff = readCachedStaff();
        var cachedAudit = readCachedAudit();
        var shouldSeedRemote = (!remoteStaff.length && cachedStaff.length) || (!remoteAudit.length && cachedAudit.length);

        if (!shouldSeedRemote) {
          return results;
        }

        return window.SolarynAPI.importSnapshotToBackend({
          staff: cachedStaff,
          audit: cachedAudit,
          replace: false,
        }).then(function (snapshot) {
          return cacheRemoteState(snapshot.staff || [], snapshot.audit || []);
        });
      })
      .catch(function () {
        return {
          staff: readCachedStaff(),
          audit: readCachedAudit(),
        };
      });

    return remoteBootstrapPromise.then(function () {
      return fetchRemoteState().catch(function () {
        return {
          staff: readCachedStaff(),
          audit: readCachedAudit(),
        };
      });
    });
  }

  function getStaff() {
    return ensureRemoteState().then(function (state) {
      return state.staff;
    });
  }

  function getAudit() {
    return ensureRemoteState().then(function (state) {
      return state.audit;
    });
  }

  function addAudit(action, details) {
    var auditEntry = {
      id: crypto.randomUUID(),
      action: action,
      details: details,
      at: new Date().toISOString(),
    };

    if (hasBackendAccess()) {
      return window.SolarynAPI.addAuditToBackend({
        action: action,
        details: details,
      }).then(function (entry) {
        var nextAudit = mergeAuditEntries([entry].concat(readCachedAudit()));
        writeCachedAudit(nextAudit);
        return entry;
      });
    }

    var nextAudit = mergeAuditEntries([auditEntry].concat(readCachedAudit()));
    writeCachedAudit(nextAudit);
    return Promise.resolve(auditEntry);
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
    var nowIso = new Date().toISOString();
    var localRecord = {
      id: crypto.randomUUID(),
      username: payload.username,
      position: payload.position,
      password: payload.password || generatePassword(),
      challengeCode: payload.challengeCode || generateChallengeCode(),
      challengeExpiresAt: addHours(nowIso, CHALLENGE_EXPIRE_HOURS),
      lastRotatedAt: nowIso,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (hasBackendAccess()) {
      return window.SolarynAPI.addStaffToBackend(localRecord).then(function (record) {
        var nextStaff = readCachedStaff();
        nextStaff.push(normalizeRecord(record));
        writeCachedStaff(nextStaff);
        return normalizeRecord(record);
      });
    }

    var staff = readCachedStaff();
    staff.push(localRecord);
    saveStaff(staff);
    return addAudit("staff.create", "Created record for " + payload.username + " with challenge code.").then(function () {
      return localRecord;
    });
  }

  function updateStaff(id, updates) {
    var staff = readCachedStaff();
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
      return Promise.resolve(null);
    }

    if (hasBackendAccess()) {
      return window.SolarynAPI.updateStaffOnBackend(id, updated).then(function (record) {
        var remoteUpdated = normalizeRecord(record);
        var remoteStaff = next.map(function (recordItem) {
          return recordItem.id === id ? remoteUpdated : recordItem;
        });
        writeCachedStaff(remoteStaff);
        return remoteUpdated;
      });
    }

    saveStaff(next);
    return addAudit("staff.update", "Updated record for " + updated.username).then(function () {
      return updated;
    });
  }

  function removeStaff(id) {
    var staff = readCachedStaff();
    var found = staff.find(function (row) {
      return row.id === id;
    });
    if (!found) {
      return Promise.resolve(false);
    }
    var next = staff.filter(function (row) {
      return row.id !== id;
    });

    if (hasBackendAccess()) {
      return window.SolarynAPI.deleteStaffFromBackend(id).then(function () {
        writeCachedStaff(next);
        return true;
      });
    }

    saveStaff(next);
    return addAudit("staff.delete", "Deleted record for " + found.username).then(function () {
      return true;
    });
  }

  function rotateStaffCredential(id) {
    var current = readCachedStaff().find(function (row) {
      return row.id === id;
    });

    if (!current) {
      return Promise.resolve(null);
    }

    if (hasBackendAccess()) {
      return window.SolarynAPI.rotateStaffOnBackend(id).then(function (rotated) {
        var updated = normalizeRecord(rotated);
        var nextStaff = readCachedStaff().map(function (record) {
          return record.id === id ? updated : record;
        });
        writeCachedStaff(nextStaff);
        return updated;
      });
    }

    var nowIso = new Date().toISOString();
    return updateStaff(id, {
      username: current.username,
      position: current.position,
      password: generatePassword(),
      challengeCode: generateChallengeCode(),
      challengeExpiresAt: addHours(nowIso, CHALLENGE_EXPIRE_HOURS),
      lastRotatedAt: nowIso,
      status: current.status,
    }).then(function (updated) {
      return addAudit("staff.rotate", "Rotated password and challenge for " + current.username).then(function () {
        return updated;
      });
    });
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
    return Promise.all([getStaff(), getAudit()]).then(function (results) {
      var snapshot = {
        exportedAt: new Date().toISOString(),
        staff: results[0],
        audit: results[1],
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
        var normalizedStaff = snapshot.staff.map(normalizeRecord);
        var normalizedAudit = mergeAuditEntries(snapshot.audit);

        if (hasBackendAccess()) {
          return window.SolarynAPI.importSnapshotToBackend({
            staff: normalizedStaff,
            audit: normalizedAudit,
            replace: true,
          }).then(function (remoteSnapshot) {
            cacheRemoteState(remoteSnapshot.staff || [], remoteSnapshot.audit || []);
            return {
              staff: normalizedStaff.length,
              audit: normalizedAudit.length,
            };
          });
        }

        saveStaff(normalizedStaff);
        writeCachedAudit(normalizedAudit);
        return addAudit("backup.import", "Imported encrypted backup file.").then(function () {
          return {
            staff: normalizedStaff.length,
            audit: normalizedAudit.length,
          };
        });
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