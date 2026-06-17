/* ============================================================
   ADEPTIO · single-file preview bundler — v2.4.1.smbowner
   Inlines tokens.css + app.css + every script into ONE portable
   HTML you can double-click or email. (Series convention:
   make-preview.js → preview-*.html.)  Run: node tools/make-preview.js
   ============================================================ */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

const css = ["css/tokens.css", "css/app.css"].map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n");
const js = [
  "js/i18n.js", "js/ui.js", "js/data.js", "js/engine/tax.js", "js/engine/payroll.js", "js/engine/ledger.js", "js/engine/reports.js", "js/engine/flags.js", "js/engine/approvals.js", "js/engine/dbops.js", "js/engine/work.js", "js/engine/registration.js", "js/engine/profile.js", "js/engine/calendar.js", "js/engine/schedule.js", "js/engine/comms.js", "js/engine/staffdash.js", "js/auth.js",
  "js/screens/staff.js", "js/screens/owner.js", "js/screens/platform.js",
  "js/personas.js", "js/screens/authviews.js", "js/app.js"
].map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Adeptio Adaptive HR — Owner Edition · v2.4.1.smbowner (preview)</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%235C6493'/><text x='32' y='44' font-size='36' font-family='Manrope,sans-serif' font-weight='700' fill='white' text-anchor='middle'>A</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Lao:wght@400;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body data-persona="">
<div id="app" aria-live="polite"></div>
<script>
${js}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(root, "preview-smbowner.html"), html);
console.log("wrote preview-smbowner.html (" + (html.length / 1024).toFixed(0) + " KB)");
