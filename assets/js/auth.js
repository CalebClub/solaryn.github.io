(function () {
  "use strict";

  var MASTER_PASSWORD = "ADMINSOLARYNACCPETEDZEAO";
  var SESSION_KEY = "solaryn_auth";
  var SESSION_TS_KEY = "solaryn_auth_time";
  var LAST_ACTIVITY_KEY = "solaryn_activity";
  var ATTEMPT_KEY = "solaryn_attempts";
  var MAX_ATTEMPTS = 5;
  var LOCKOUT_MS = 10 * 60 * 1000;
  var IDLE_TIMEOUT_MS = 20 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function getAttemptState() {
    var raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) {
      return { count: 0, lockedUntil: 0 };
    }
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return { count: 0, lockedUntil: 0 };
    }
  }

  function setAttemptState(state) {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(state));
  }

  function touchActivity() {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
  }

  function setAuthenticated() {
    sessionStorage.setItem(SESSION_KEY, "ok");
    sessionStorage.setItem(SESSION_TS_KEY, String(now()));
    touchActivity();
  }

  function clearAuthenticated() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_TS_KEY);
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  }

  function isAuthenticated() {
    if (sessionStorage.getItem(SESSION_KEY) !== "ok") {
      return false;
    }

    var lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || "0");
    if (!lastActivity || now() - lastActivity > IDLE_TIMEOUT_MS) {
      clearAuthenticated();
      return false;
    }

    return true;
  }

  function login(password) {
    var state = getAttemptState();

    if (state.lockedUntil > now()) {
      return Promise.resolve({
        ok: false,
        message:
          "Access locked due to failed attempts. Try again in " +
          Math.ceil((state.lockedUntil - now()) / 60000) +
          " minute(s).",
      });
    }

    // Try backend authentication first if available
    if (window.SolarynAPI) {
      return window.SolarynAPI.login(password)
        .then(function (data) {
          // Backend login successful
          setAuthenticated();
          setAttemptState({ count: 0, lockedUntil: 0 });
          return { ok: true, message: "Access granted." };
        })
        .catch(function () {
          // Backend login failed, fall back to local validation
          if (password === MASTER_PASSWORD) {
            setAuthenticated();
            setAttemptState({ count: 0, lockedUntil: 0 });
            return { ok: true, message: "Access granted (offline mode)." };
          }

          state.count += 1;
          if (state.count >= MAX_ATTEMPTS) {
            state.lockedUntil = now() + LOCKOUT_MS;
            state.count = 0;
          }
          setAttemptState(state);

          return { ok: false, message: "Invalid master password." };
        });
    }

    // Fallback if API is not available
    if (password === MASTER_PASSWORD) {
      setAuthenticated();
      setAttemptState({ count: 0, lockedUntil: 0 });
      return Promise.resolve({ ok: true, message: "Access granted." });
    }

    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = now() + LOCKOUT_MS;
      state.count = 0;
    }
    setAttemptState(state);

    return Promise.resolve({ ok: false, message: "Invalid master password." });
  }

  function logout() {
    if (window.SolarynAPI) {
      window.SolarynAPI.clearToken();
    }
    clearAuthenticated();
    window.location.href = "index.html";
  }

  function attachActivityListeners() {
    ["click", "keydown", "mousemove", "touchstart"].forEach(function (eventName) {
      window.addEventListener(eventName, touchActivity, { passive: true });
    });
  }

  function installGuard() {
    if (!isAuthenticated()) {
      window.location.href = "index.html";
      return;
    }

    attachActivityListeners();
    setInterval(function () {
      if (!isAuthenticated()) {
        window.location.href = "index.html";
      }
    }, 15000);

    var logoutBtn = document.getElementById("logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  }

  function initLoginPage() {
    if (isAuthenticated()) {
      window.location.href = "dashboard.html";
      return;
    }

    var form = document.getElementById("login-form");
    var message = document.getElementById("login-message");
    var input = document.getElementById("master-password");

    if (!form || !message || !input) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var password = input.value.trim();
      message.textContent = "Authenticating...";
      form.style.opacity = "0.5";
      form.style.pointerEvents = "none";

      login(password).then(function (result) {
        message.textContent = result.message;
        form.style.opacity = "1";
        form.style.pointerEvents = "auto";

        if (result.ok) {
          setTimeout(function () {
            window.location.href = "dashboard.html";
          }, 300);
        }
      });
    });
  }

  window.SolarynAuth = {
    initLoginPage: initLoginPage,
    installGuard: installGuard,
    logout: logout,
    isAuthenticated: isAuthenticated,
  };
})();