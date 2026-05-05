(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var exportForm = document.getElementById("export-form");
  var importForm = document.getElementById("import-form");
  var message = document.getElementById("backup-message");

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