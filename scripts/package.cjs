const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const p = require("../package.json");
fs.mkdirSync("dist", { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/@vscode/vsce/vsce",
    "package",
    "--no-dependencies",
    "--allow-missing-repository",
    "--out",
    `dist/${p.name}-${p.version}.vsix`,
  ],
  { stdio: "inherit" },
);
