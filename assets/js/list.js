(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var table = document.getElementById("staff-table");
  var message = document.getElementById("list-message");

  function formatTime(iso) {
    return new Date(iso).toLocaleString();
  }

  function rowTemplate(record) {
    return (
      "<tr data-id='" +
      record.id +
      "'>" +
      "<td><input data-field='username' value='" +
      escapeHtml(record.username) +
      "'></td>" +
      "<td><input data-field='position' value='" +
      escapeHtml(record.position) +
      "'></td>" +
      "<td><input data-field='password' value='" +
      escapeHtml(record.password) +
      "'></td>" +
      "<td><input data-field='challengeCode' value='" +
      escapeHtml(record.challengeCode || "") +
      "'></td>" +
      "<td>" +
      record.status +
      "</td>" +
      "<td>" +
      formatTime(record.updatedAt) +
      "</td>" +
      "<td class='row'>" +
      "<button class='btn' data-action='rotate' type='button'>Rotate All</button>" +
      "<button class='btn' data-action='regen' type='button'>Regenerate</button>" +
      "<button class='btn btn-primary' data-action='save' type='button'>Update</button>" +
      "<button class='btn btn-danger' data-action='delete' type='button'>Delete</button>" +
      "</td>" +
      "</tr>"
    );
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    var staff = window.SolarynStore.getStaff();
    if (!staff.length) {
      table.innerHTML = "<tr><td colspan='7'>No staff credentials found. Create records in Password Generator.</td></tr>";
      return;
    }

    table.innerHTML = staff
      .map(function (record) {
        return rowTemplate(record);
      })
      .join("");
  }

  table.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var row = button.closest("tr");
    var id = row.getAttribute("data-id");
    var action = button.getAttribute("data-action");
    var inputs = row.querySelectorAll("input[data-field]");
    var next = {};
    inputs.forEach(function (input) {
      next[input.getAttribute("data-field")] = input.value.trim();
    });

    if (action === "regen") {
      row.querySelector("input[data-field='password']").value = window.SolarynUtils.generatePassword();
      message.textContent = "Generated a new password for this row. Press Update to save.";
      return;
    }

    if (action === "rotate") {
      window.SolarynStore.rotateStaffCredential(id);
      message.textContent = "Rotated password and challenge code for this staff account.";
      render();
      return;
    }

    if (action === "delete") {
      window.SolarynStore.removeStaff(id);
      message.textContent = "Deleted staff record.";
      render();
      return;
    }

    if (!next.username || !next.position || !next.password || !next.challengeCode) {
      message.textContent = "Username, position, password, and challenge code cannot be empty.";
      return;
    }

    var existing = window.SolarynStore.getStaff().find(function (rowData) {
      return rowData.id === id;
    });
    window.SolarynStore.updateStaff(id, {
      username: next.username,
      position: next.position,
      password: next.password,
      challengeCode: next.challengeCode,
      status: existing ? existing.status : "active",
    });
    message.textContent = "Staff record updated.";
    render();
  });

  render();
})();