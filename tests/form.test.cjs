const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const { sample } = require("../src/model");
test("real form renders, edits, publishes and follows document updates", async () => {
  const dom = new JSDOM(fs.readFileSync("media/body.html", "utf8"), {
      runScripts: "outside-only",
      url: "https://extension.test",
    }),
    w = dom.window;
  const errors = [];
  w.addEventListener("error", (e) => errors.push(e.error));
  const config = {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "v",
    head: "main",
  };
  let text = sample(config, "2026-09-30"),
    version = 1;
  w.acquireVsCodeApi = () => ({
    postMessage(m) {
      if (m.type === "edit") {
        text = m.text;
        version++;
      }
      queueMicrotask(() =>
        w.dispatchEvent(
          new w.MessageEvent("message", {
            data: { type: "update", text, version, config, ack: m.id },
          }),
        ),
      );
    },
  });
  for (const name of ["engine", "rules", "app"])
    w.eval(fs.readFileSync(`media/${name}.js`, "utf8"));
  const tick = () => new Promise((r) => setImmediate(r));
  await tick();
  const q = (s) => w.document.querySelector(s),
    event = (s, value, type = "input") => {
      q(s).value = value;
      q(s).dispatchEvent(new w.Event(type, { bubbles: true }));
    };
  assert.equal(w.document.querySelectorAll(".release").length, 2);
  assert.equal(q('[data-r="0"] [data-field="date"]'), null);
  assert.equal(q('[data-r="0"] [data-field="yanked"]'), null);
  q('[data-r="0"] [data-action="add-item"]').click();
  await tick();
  event('[data-r="0"] select', "Security", "change");
  await tick();
  event('[data-field="cve"]', "CVE-2026-12345");
  await tick();
  event('[data-r="0"] .itemtext', "Security fix");
  await tick();
  assert(text.includes("CVE-2026-12345: Security fix"));
  q('[data-action="create-release"]').click();
  await tick();
  assert.equal(w.document.querySelectorAll(".release").length, 3);
  assert.equal(q('[data-r="0"] .item'), null);
  assert.equal(q('[data-r="1"] .itemtext').value, "Security fix");
  text = text.replace("Security fix", "Source edit");
  version++;
  w.dispatchEvent(
    new w.MessageEvent("message", {
      data: { type: "update", text, version, config },
    }),
  );
  assert.equal(q('[data-r="1"] .itemtext').value, "Source edit");
  assert.deepEqual(errors, []);
  dom.window.close();
});
