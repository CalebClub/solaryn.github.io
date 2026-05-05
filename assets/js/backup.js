(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var exportForm = document.getElementById("export-form");
  var importForm = document.getElementById("import-form");
  var message = document.getElementById("backup-message");
  var pushBtn = document.getElementById("push-to-backend");
  var syncMessage = document.getElementById("sync-message");
  var syncStatus = document.getElementById("sync-status");

  function updateSyncStatus() {
    if (window.SolarynAPI && window.SolarynAPI.getToken()) {
      syncStatus.textContent = "Status: Connected to backend.";
    } else {
      syncStatus.textContent = "Status: Not connected to backend. Log in while the backend is running to enable sync.";
    }
  }

  updateSyncStatus();

  pushBtn.addEventListener("click", function () {
    if (!window.SolarynAPI || !window.SolarynAPI.getToken()) {
      syncMessage.textContent = "Not connected to backend. Log in while the backend server is running first.";
      return;
    }

    var staff = JSON.parse(localStorage.getItem("solaryn_staff_records") || "[]");
    var audit = JSON.parse(localStorage.getItem("solaryn_audit_log") || "[]");

    pushBtn.disabled = true;
    syncMessage.textContent = "Pushing…";

    window.SolarynAPI.importSnapshotToBackend({ staff: staff, audit: audit, replace: true })
      .then(function (result) {
        syncMessage.textContent =
          "Pushed " + (result.staff ? result.staff.length : staff.length) + " staff record(s) and " +
          (result.audit ? result.audit.length : audit.length) + " audit event(s) to the backend. All browsers will now see this data.";
      })
      .catch(function (err) {
        syncMessage.textContent = "Push failed: " + err.message;
      })
      .finally(function () {
        pushBtn.disabled = false;
      });
  });

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  exportForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var passphrase = document.getElementById("export-passphrase").value;
    window.SolarynCrypto.exportEncrypted(passphrase)
      .then(function (payload) {
        var stamp = new Date().toISOString().replace(/[:.]/g, "-");
        download("solaryn-backup-" + stamp + ".json", payload);
        return window.SolarynStore.addAudit("backup.export", "Created encrypted backup file.").then(function () {
          message.textContent = "Encrypted backup generated and downloaded.";
          exportForm.reset();
        });
      })
      .catch(function (error) {
        message.textContent = "Export failed: " + error.message;
      });
  });

  importForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var file = document.getElementById("import-file").files[0];
    var passphrase = document.getElementById("import-passphrase").value;
    if (!file) {
      message.textContent = "Choose a backup file first.";
      return;
    }

    file
      .text()
      .then(function (content) {
        return window.SolarynCrypto.importEncrypted(content, passphrase);
      })
      .then(function (result) {
        message.textContent =
          "Backup restored. Imported " + result.staff + " staff record(s) and " + result.audit + " audit event(s).";
        importForm.reset();
      })
      .catch(function (error) {
        message.textContent = "Import failed: " + error.message;
      });
  });
})();