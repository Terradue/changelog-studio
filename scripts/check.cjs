const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
for (const dir of ["src", "media", "scripts"])
  for (const f of fs.readdirSync(dir))
    if (/\.(c?js)$/.test(f))
      execFileSync(process.execPath, ["--check", dir + "/" + f], {
        stdio: "inherit",
      });
