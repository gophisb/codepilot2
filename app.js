/* CodePilot2 preview helper — intentionally minimal and valid. */
"use strict";
window.addEventListener("error", function (e) {
  var p = document.createElement("pre");
  p.textContent = "Preview Error: " + (e.message || "Unknown error");
  p.style.cssText = "white-space:pre-wrap;background:#fee;color:#900;padding:12px;font:14px system-ui";
  document.body.insertBefore(p, document.body.firstChild);
});
