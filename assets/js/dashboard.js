(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var staff = window.SolarynStore.getStaff();
  var audit = window.SolarynStore.getAudit();
  var policy = window.SolarynStore.getPolicy();
  var now = Date.now();

  document.getElementById("staff-count").textContent = String(staff.length);
  document.getElementById("active-count").textContent = String(
    staff.filter(function (record) {
      return record.status === "active";
    }).length
  );
  document.getElementById("audit-count").textContent = String(audit.length);
  document.getElementById("challenge-expiring-count").textContent = String(
    staff.filter(function (record) {
      return new Date(record.challengeExpiresAt).getTime() - now < 24 * 60 * 60 * 1000;
    }).length
  );
  document.getElementById("rotation-needed-count").textContent = String(
    staff.filter(function (record) {
      var rotatedAt = new Date(record.lastRotatedAt || record.updatedAt).getTime();
      return now - rotatedAt > policy.rotateAfterDays * 24 * 60 * 60 * 1000;
    }).length
  );

  var preview = document.getElementById("audit-preview");
  if (!audit.length) {
    preview.innerHTML = "<li>No events yet. Start by creating a staff password.</li>";
  } else {
    preview.innerHTML = audit
      .slice(0, 8)
      .map(function (entry) {
        var at = new Date(entry.at).toLocaleString();
        return "<li><strong>" + entry.action + "</strong><br>" + entry.details + "<br><span class='muted'>" + at + "</span></li>";
      })
      .join("");
  }
})();