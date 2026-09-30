const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { sample } = require("../../src/model");
const config = {
  url: "https://github.com/o/r",
  provider: "github",
  prefix: "v",
  head: "main",
};
async function boot(page) {
  await page.setContent(
    fs.readFileSync(path.join(__dirname, "../../media/body.html"), "utf8"),
  );
  await page.addStyleTag({
    path: path.join(__dirname, "../../media/style.css"),
  });
  await page.evaluate(
    ({ text, config }) => {
      window.host = { text, config, version: 1, messages: [], conflict: false };
      window.acquireVsCodeApi = () => ({
        postMessage(m) {
          host.messages.push(m);
          if (m.type === "recover") return;
          if (m.type === "edit" && !host.conflict) {
            host.text = m.text;
            host.version++;
          }
          setTimeout(
            () =>
              window.dispatchEvent(
                new MessageEvent("message", {
                  data: {
                    type: "update",
                    text: host.text,
                    version: host.version,
                    config: host.config,
                    ack: m.id,
                    conflict: m.type === "edit" && host.conflict,
                  },
                }),
              ),
            0,
          );
        },
      });
    },
    { text: sample(config, "2026-09-30"), config },
  );
  for (const file of ["engine.js", "rules.js", "app.js"])
    await page.addScriptTag({
      path: path.join(__dirname, "../../media", file),
    });
  await expect(page.locator(".release")).toHaveCount(2);
}
test("protected Unreleased, Security CVE, create release and live external sync", async ({
  page,
}) => {
  await boot(page);
  const u = page.locator('[data-r="0"]');
  await expect(u.locator('[data-field="version"]')).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(u.locator('[data-field="date"]')).toHaveCount(0);
  await expect(u.locator('[data-field="yanked"]')).toHaveCount(0);
  await u.getByRole("button", { name: "+ Add change", exact: true }).click();
  await u.locator("select").selectOption("Security");
  await u.locator('[data-field="cve"]').fill("CVE-2026-12345");
  await u.locator('[data-field="breaking"]').check();
  await u.locator(".itemtext").fill("Fix vulnerability");
  await expect
    .poll(() => page.evaluate(() => host.text))
    .toContain("CVE-2026-12345: **Breaking:** Fix vulnerability");
  await u.getByRole("button", { name: "Create release" }).click();
  await expect(page.locator(".release")).toHaveCount(3);
  await expect(u.locator(".item")).toHaveCount(0);
  await expect(page.locator('[data-r="1"] .itemtext')).toHaveValue(
    "Fix vulnerability",
  );
  await expect
    .poll(() => page.evaluate(() => host.text))
    .toContain("/compare/v0.1.0...v0.1.1");
  await page.evaluate(() => {
    host.text = host.text.replace("Fix vulnerability", "Changed in Markdown");
    host.version++;
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "update", ...host } }),
    );
  });
  await expect(page.locator('[data-r="1"] .itemtext')).toHaveValue(
    "Changed in Markdown",
  );
});
test("conflicting edits are recoverable and newer document wins", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    host.conflict = true;
    host.text = host.text.replace("Initial release", "External change");
    host.version++;
  });
  await page.locator('[data-r="1"] .itemtext').fill("Form draft");
  await expect(page.locator("#status")).toContainText(
    "Recover Conflicting Draft",
  );
  await expect(page.locator('[data-r="1"] .itemtext')).toHaveValue(
    "External change",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        host.messages.some(
          (m) => m.type === "recover" && m.text.includes("Form draft"),
        ),
      ),
    )
    .toBe(true);
});
test("dates, SemVer and release deletion", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "+ Add release" }).click();
  await expect(page.locator(".release")).toHaveCount(3);
  const newer = page.locator('[data-r="1"]');
  await newer.locator('[data-field="version"]').fill("invalid");
  await expect(newer.locator("#version-error-1")).toContainText("SemVer");
  await newer.locator('[data-field="version"]').fill("0.2.0");
  await expect(newer.locator('[data-field="date"]')).toHaveAttribute(
    "min",
    "2026-09-30",
  );
  await newer.getByRole("button", { name: "Remove release" }).click();
  await page.locator('dialog button[value="remove"]').click();
  await expect(page.locator(".release")).toHaveCount(2);
  await expect
    .poll(() => page.evaluate(() => host.text.includes("[0.2.0]:")))
    .toBe(false);
});
