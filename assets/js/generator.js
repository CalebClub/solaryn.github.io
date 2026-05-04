(function () {
  "use strict";

  window.SolarynAuth.installGuard();

  var output = document.getElementById("generated-password");
  var passwordInput = document.getElementById("password");
  var message = document.getElementById("generator-message");
  var generateBtn = document.getElementById("generate-btn");
  var copyBtn = document.getElementById("copy-btn");
  var assignForm = document.getElementById("assign-form");

  function generate() {
    var pass = window.SolarynUtils.generatePassword();
    output.textContent = pass;
    passwordInput.value = pass;
    message.textContent = "Generated a new 20-character random staff password.";
  }

  generateBtn.addEventListener("click", generate);
  copyBtn.addEventListener("click", function () {
    if (!passwordInput.value) {
      message.textContent = "Generate a password first.";
      return;
    }
    navigator.clipboard.writeText(passwordInput.value).then(function () {
      message.textContent = "Password copied to clipboard.";
    });
  });

  assignForm.addEventListener("submit", function (event) {
    event.preventDefault();

    var username = document.getElementById("username").value.trim();
    var position = document.getElementById("position").value.trim();
    var password = passwordInput.value.trim();

    if (!username || !position || !password) {
      message.textContent = "Username, position, and password are required.";
      return;
    }

    window.SolarynStore.addStaff({
      username: username,
      position: position,
      password: password,
    });

    assignForm.reset();
    output.textContent = "Press Generate";
    message.textContent = "Staff credential saved successfully.";
  });

  generate();
})();