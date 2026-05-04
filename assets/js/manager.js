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

  function selectedRecord() {
    var id = select.value;
    return window.SolarynStore.getStaff().find(function (record) {
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
    var staff = window.SolarynStore.getStaff();
    if (!staff.length) {
      select.innerHTML = "<option value=''>No staff records</option>";
      fillForm(null);
      return;
    }

    select.innerHTML = staff
      .map(function (record) {
        return "<option value='" + record.id + "'>" + record.username + " - " + record.position + "</option>";
      })
      .join("");
    fillForm(staff[0]);
  }

  function renderAudit() {
    var audit = window.SolarynStore.getAudit();
    if (!audit.length) {
      auditList.innerHTML = "<li>No audit events yet.</li>";
      return;
    }
    auditList.innerHTML = audit
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
    window.SolarynStore.rotateStaffCredential(current.id);
    message.textContent = "Rotated password and challenge code.";
    renderOptions();
    select.value = current.id;
    fillForm(selectedRecord());
    renderAudit();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var current = selectedRecord();
    if (!current) {
      message.textContent = "No record selected.";
      return;
    }

    window.SolarynStore.updateStaff(current.id, {
      username: username.value.trim(),
      position: position.value.trim(),
      password: password.value.trim(),
      challengeCode: challenge.value.trim(),
      status: current.status,
    });

    message.textContent = "Staff details updated.";
    renderOptions();
    select.value = current.id;
    fillForm(selectedRecord());
    renderAudit();
  });

  document.getElementById("deactivate-btn").addEventListener("click", function () {
    var current = selectedRecord();
    if (!current) {
      return;
    }
    window.SolarynStore.updateStaff(current.id, {
      username: current.username,
      position: current.position,
      password: current.password,
      challengeCode: current.challengeCode,
      status: "inactive",
    });
    message.textContent = "Staff status set to inactive.";
    renderOptions();
    select.value = current.id;
    fillForm(selectedRecord());
    renderAudit();
  });

  document.getElementById("activate-btn").addEventListener("click", function () {
    var current = selectedRecord();
    if (!current) {
      return;
    }
    window.SolarynStore.updateStaff(current.id, {
      username: current.username,
      position: current.position,
      password: current.password,
      challengeCode: current.challengeCode,
      status: "active",
    });
    message.textContent = "Staff status set to active.";
    renderOptions();
    select.value = current.id;
    fillForm(selectedRecord());
    renderAudit();
  });

  renderOptions();
  renderAudit();
})();