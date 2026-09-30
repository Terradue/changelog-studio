const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  minimalEdit,
  sample,
  gitRepository,
  remoteUrl,
  settingsFrom,
  C,
} = require("../src/model");
test("minimal edits preserve unchanged text and Unicode", () => {
  for (const [a, b] of [
    ["abc", "abxc"],
    ["hello", ""],
    ["", "hello"],
    ["😀 first", "😀 last"],
    ["a\r\nb", "a\r\nc"],
  ]) {
    const e = minimalEdit(a, b);
    assert.equal(a.slice(0, e.start) + e.text + a.slice(e.end), b);
  }
});
test("new sample contains empty Unreleased and one initial release item", () => {
  const rs = C.parse(sample(null, "2026-09-30")).releases;
  assert.equal(rs.length, 2);
  assert.equal(rs[0].items.length, 0);
  assert.equal(rs[1].version, "0.1.0");
  assert.equal(rs[1].items[0].text, "Initial release");
});
test("Git uses deepest matching worktree and upstream remote", () => {
  const uri = {
    scheme: "file",
    authority: "",
    path: "/repo/nested/CHANGELOG.md",
  };
  const repo = (path) => ({
    rootUri: { ...uri, path },
    state: {
      remotes: [
        { name: "origin", fetchUrl: "git@github.com:a/b.git" },
        { name: "upstream", fetchUrl: "https://github.com/c/d" },
      ],
      HEAD: { upstream: { remote: "upstream" } },
    },
  });
  const nested = repo("/repo/nested");
  assert.equal(
    gitRepository([repo("/repo"), nested, repo("/repos")], uri),
    nested,
  );
  assert.equal(remoteUrl(nested), "https://github.com/c/d");
});
test("existing link supplies prefix/ref and Git supplies URL", () => {
  const config = {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "release-",
    head: "develop",
  };
  const result = settingsFrom(
    sample(config, "2026-09-30"),
    "git@github.com:new/project.git",
    null,
  );
  assert.deepEqual(result, {
    ...config,
    url: "https://github.com/new/project",
  });
  assert.equal(
    settingsFrom("# Changelog", "https://github.com/o/r", null),
    null,
  );
});
test('Git host detection overrides the imported host for public remotes',()=>{const config={url:'https://gitlab.com/o/r',provider:'gitlab',prefix:'v',head:'main'};assert.equal(settingsFrom(sample(config,'2026-09-30'),'https://github.com/o/r',null).provider,'github')});
