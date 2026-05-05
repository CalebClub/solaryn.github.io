(function () {
  "use strict";

  // Configuration - adjust this to match your backend URL
  var BACKEND_URL = localStorage.getItem("solaryn_backend_url") || "postgresql://staff_j1n0_user:EKLbzr97mQh9btU8JQ1EMfT9zvdQumh6@dpg-d7skp7ok1i2s739s6t9g-a.virginia-postgres.render.com/staff_j1n0";
  var TOKEN_KEY = "solaryn_backend_token";
  var TOKEN_EXPIRY_KEY = "solaryn_backend_token_expiry";

  function setBackendUrl(url) {
    localStorage.setItem("solaryn_backend_url", url);
    BACKEND_URL = url;
  }

  function getBackendUrl() {
    return BACKEND_URL;
  }

  function setToken(token, expiresInMs) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInMs));
  }

  function getToken() {
    var token = sessionStorage.getItem(TOKEN_KEY);
    var expiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) || "0");
    if (!token || Date.now() > expiry) {
      clearToken();
      return null;
    }
    return token;
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  function apiCall(method, path, body) {
    var token = getToken();
    var options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers.Authorization = "Bearer " + token;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(BACKEND_URL + path, options).then(function (res) {
      if (res.status === 401) {
        clearToken();
        throw new Error("Unauthorized: token expired or invalid");
      }
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error || "API error: " + res.status);
        });
      }
      return res.json();
    });
  }

  function login(masterPassword) {
    return apiCall("POST", "/api/login", {
      masterPassword: masterPassword,
    }).then(function (data) {
      if (data.token) {
        setToken(data.token, data.expiresInMs);
      }
      return data;
    });
  }

  function getHealth() {
    return fetch(BACKEND_URL + "/api/health")
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function getStaffFromBackend() {
    return apiCall("GET", "/api/staff").then(function (data) {
      return data.staff || [];
    });
  }

  function addStaffToBackend(payload) {
    return apiCall("POST", "/api/staff", {
      username: payload.username,
      position: payload.position,
      password: payload.password,
      challengeCode: payload.challengeCode,
    });
  }

  function updateStaffOnBackend(id, updates) {
    return apiCall("PUT", "/api/staff/" + id, {
      username: updates.username,
      position: updates.position,
      password: updates.password,
      challengeCode: updates.challengeCode,
      challengeExpiresAt: updates.challengeExpiresAt,
      lastRotatedAt: updates.lastRotatedAt,
      status: updates.status,
    });
  }

  function rotateStaffOnBackend(id) {
    return apiCall("POST", "/api/staff/" + id + "/rotate", {});
  }

  function deleteStaffFromBackend(id) {
    return apiCall("DELETE", "/api/staff/" + id, {});
  }

  function getAuditFromBackend() {
    return apiCall("GET", "/api/audit").then(function (data) {
      return data.audit || [];
    });
  }

  function addAuditToBackend(payload) {
    return apiCall("POST", "/api/audit", {
      action: payload.action,
      details: payload.details,
    });
  }

  function importSnapshotToBackend(payload) {
    return apiCall("POST", "/api/import", {
      staff: payload.staff || [],
      audit: payload.audit || [],
      replace: payload.replace === true,
    });
  }

  function getPolicy() {
    return apiCall("GET", "/api/policy").then(function (data) {
      return data;
    });
  }

  function isBackendAvailable() {
    return getHealth().then(function (data) {
      return data.ok === true;
    });
  }

  window.SolarynAPI = {
    setBackendUrl: setBackendUrl,
    getBackendUrl: getBackendUrl,
    setToken: setToken,
    getToken: getToken,
    clearToken: clearToken,
    login: login,
    isBackendAvailable: isBackendAvailable,
    getStaffFromBackend: getStaffFromBackend,
    addStaffToBackend: addStaffToBackend,
    updateStaffOnBackend: updateStaffOnBackend,
    rotateStaffOnBackend: rotateStaffOnBackend,
    deleteStaffFromBackend: deleteStaffFromBackend,
    getAuditFromBackend: getAuditFromBackend,
    addAuditToBackend: addAuditToBackend,
    importSnapshotToBackend: importSnapshotToBackend,
    getPolicy: getPolicy,
  };
})();
