(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var select = document.getElementById("staff-select");
  var username = document.getElementById("manager-username");
  var position = document.getElementById("manager-position");
  var password = document.getElementById("manager-password");
  var challenge = document.getElementById("manager-challenge");
  var challengeExpiry = document.getElementById("challenge-expiry");
  var message = document.getElementById("manager-message");
  var form = document.getElementById("manager-form");
  var auditList = document.getElementById("audit-list");
  var staffRecords = [];
  var auditRecords = [];

  function selectedRecord() {
    var id = select.value;
    return staffRecords.find(function (record) {
      return record.id === id;
    });
  }

  function fillForm(record) {
    if (!record) {
      username.value = "";
      position.value = "";
      password.value = "";
      challenge.value = "";
      challengeExpiry.textContent = "";
      return;
    }
    username.value = record.username;
    position.value = record.position;
    password.value = record.password;
    challenge.value = record.challengeCode || "";
    challengeExpiry.textContent = "Challenge expires: " + new Date(record.challengeExpiresAt).toLocaleString();
  }

  function renderOptions() {
    if (!staffRecords.length) {
      select.innerHTML = "<option value=''>No staff records</option>";
      fillForm(null);
      return;
    }

    select.innerHTML = staffRecords
      .map(function (record) {
        return "<option value='" + record.id + "'>" + record.username + " - " + record.position + "</option>";
      })
      .join("");
    fillForm(staffRecords[0]);
  }

  function renderAudit() {
    if (!auditRecords.length) {
      auditList.innerHTML = "<li>No audit events yet.</li>";
      return;
    }
    auditList.innerHTML = auditRecords
      .slice(0, 50)
      .map(function (entry) {
        return (
          "<li><strong>" +
          entry.action +
          "</strong><br>" +
          entry.details +
          "<br><span class='muted'>" +
          new Date(entry.at).toLocaleString() +
          "</span></li>"
        );
      })
      .join("");
  }

  function refresh() {
    return Promise.all([window.SolarynStore.getStaff(), window.SolarynStore.getAudit()]).then(function (results) {
      staffRecords = results[0];
      auditRecords = results[1];
      renderOptions();
      renderAudit();
    });
  }

  select.addEventListener("change", function () {
    fillForm(selectedRecord());
  });

  document.getElementById("regen-btn").addEventListener("click", function () {
    password.value = window.SolarynUtils.generatePassword();
    message.textContent = "Generated new password. Press Save Changes to commit.";
  });

  document.getElementById("regen-challenge-btn").addEventListener("click", function () {
    challenge.value = window.SolarynUtils.generateChallengeCode();
    message.textContent = "Generated new challenge code. Press Save Changes to commit.";
  });

  document.getElementById("rotate-both-btn").addEventListener("click", function () {
    var current = selectedRecord();
    if (!current) {
      message.textContent = "No record selected.";
      return;
    }
    message.textContent = "Rotating password and challenge code...";
    window.SolarynStore.rotateStaffCredential(current.id)
      .then(function () {
        message.textContent = "Rotated password and challenge code.";
        return refresh();
      })
      .then(function () {
        select.value = current.id;
        fillForm(selectedRecord());
      })
      .catch(function (error) {
        message.textContent = "Rotation failed: " + error.message;
      });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var current = selectedRecord();
    if (!current) {
      message.textContent = "No record selected.";
      return;
    }

    message.textContent = "Saving staff details...";

    window.SolarynStore.updateStaff(current.id, {
      username: username.value.trim(),
      position: position.value.trim(),
      password: password.value.trim(),
      challengeCode: challenge.value.trim(),
      status: current.status,
    })
      .then(function () {
        message.textContent = "Staff details updated.";
        return refresh();
      })
      .then(function () {
        select.value = current.id;
        fillForm(selectedRecord());
      })
      .catch(function (error) {
        message.textContent = "Update failed: " + error.message;
      });
  });

  document.getElementById("deactivate-btn").addEventListener("click", function () {
    var current = selectedRecord();
    if (!current) {
      return;
    }
    message.textContent = "Updating staff status...";
    window.SolarynStore.updateStaff(current.id, {
      username: current.username,
      position: current.position,
      password: current.password,
      challengeCode: current.challengeCode,
      status: "inactive",
    })
      .then(function () {
        message.textContent = "Staff status set to inactive.";
        return refresh();
      })
      .then(function () {
        select.value = current.id;
        fillForm(selectedRecord());
      })
      .catch(function (error) {
        message.textContent = "Status update failed: " + error.message;
      });
  });

  document.getElementById("activate-btn").addEventListener("click", function () {
    var current = selectedRecord();
    if (!current) {
      return;
    }
    message.textContent = "Updating staff status...";
    window.SolarynStore.updateStaff(current.id, {
      username: current.username,
      position: current.position,
      password: current.password,
      challengeCode: current.challengeCode,
      status: "active",
    })
      .then(function () {
        message.textContent = "Staff status set to active.";
        return refresh();
      })
      .then(function () {
        select.value = current.id;
        fillForm(selectedRecord());
      })
      .catch(function (error) {
        message.textContent = "Status update failed: " + error.message;
      });
  });

  refresh().catch(function (error) {
    message.textContent = "Could not load staff data: " + error.message;
  });
})();