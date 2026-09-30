const assert = require("node:assert/strict");
const test = require("node:test");
const C = require("../media/engine.js");
require("../media/rules.js");
const doc = (...entries) =>
  "# Changelog\n\nIntro preserved.\n\n" +
  entries
    .map(
      ([v, d = ""]) =>
        `## [${v}]${d ? " - " + d : ""}\n\n### Added\n\n- Notes for ${v}.\n\n`,
    )
    .join("") +
  "[external]: https://example.org\n";
test("official SemVer regex, including invalid imports", () => {
  for (const v of [
    "0.0.0",
    "1.2.3",
    "2.0.0-rc.1",
    "1.0.0-x-y-z.--",
    "1.2.3+001",
    "99999999999999999999.0.0",
  ])
    assert(C.semver(v), v);
  for (const v of [
    "v1.0.0",
    "1.0",
    "01.2.3",
    "1.2.3-01",
    "latest",
    "1.2.3\n",
    "1.2.3+",
    "",
  ])
    assert(!C.semver(v), v);
  const m = C.parse(
    doc(["latest", "2026-09-29"], ["01.2.3", "tomorrow"], ["", ""]),
  );
  assert.equal(m.releases.length, 3);
  assert(C.validate(m.releases).every((v) => v.version.length));
  assert.equal(m.releases[1].date, "tomorrow");
});
test("SemVer precedence and numeric precision", () => {
  const ordered = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
  ];
  for (let i = 1; i < ordered.length; i++)
    assert(C.cmp(ordered[i], ordered[i - 1]) > 0);
  assert(C.cmp("1.10.0", "1.9.0") > 0);
  assert.equal(C.cmp("1.0.0+one", "1.0.0+two"), 0);
  assert(C.cmp("9007199254740993.0.0", "9007199254740992.0.0") > 0);
});
test("Unreleased pinning preserves all bodies and references", () => {
  const source = doc(
    ["2.0.0", "2026-09-29"],
    ["Unreleased"],
    ["1.0.0", "2026-09-28"],
  );
  const pinned = C.pin(source);
  assert.deepEqual(
    C.parse(pinned).releases.map((r) => r.version),
    ["Unreleased", "2.0.0", "1.0.0"],
  );
  for (const marker of [
    "Intro preserved.",
    "Notes for 2.0.0.",
    "Notes for Unreleased.",
    "Notes for 1.0.0.",
    "[external]: https://example.org",
  ])
    assert(pinned.includes(marker));
  assert.equal(C.pin(pinned), pinned);
});
test("new releases exceed maximum version and follow Unreleased", () => {
  const source = doc(
    ["Unreleased"],
    ["1.9.0", "2026-09-30"],
    ["1.10.0", "2026-09-28"],
  );
  const r = C.parse(C.nextRelease(source, "2026-09-29")).releases;
  assert.equal(r[0].version, "Unreleased");
  assert.equal(r[1].version, "1.10.1");
  assert.equal(r[1].date, "2026-09-30");
  assert.equal(
    C.parse(C.nextRelease(doc(["2.0.0-rc.2", "2026-01-01"]), "2026-02-01"))
      .releases[0].version,
    "2.0.0",
  );
  assert.equal(
    C.parse(C.nextRelease("# Changelog\n", "2026-09-29")).releases[0].version,
    "0.1.0",
  );
});
test("real dates, chronological bounds, same-day releases", () => {
  for (const d of ["2024-02-29", "2000-02-29", "0001-01-01"])
    assert(C.validDate(d));
  for (const d of [
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "0000-01-01",
    "29/09/2026",
  ])
    assert(!C.validDate(d));
  const r = C.parse(
    doc(
      ["Unreleased"],
      ["3.0.0", "2026-09-29"],
      ["2.0.0", "2026-09-29"],
      ["1.0.0", "2026-09-20"],
    ),
  ).releases;
  const v = C.validate(r);
  assert(v.every((x) => !x.date.length && !x.version.length));
  assert.equal(v[2].min, "2026-09-20");
  assert.equal(v[2].max, "2026-09-29");
  r[2].date = "2026-09-10";
  assert(C.validate(r)[2].date.length);
  r[2].date = "2026-09-30";
  assert(C.validate(r)[2].date.length);
});
test("duplicate precedence, duplicate Unreleased and reversed versions are flagged", () => {
  for (const names of [
    ["1.0.0+a", "1.0.0+b"],
    ["1.0.0", "2.0.0"],
    ["Unreleased", "Unreleased"],
  ]) {
    const m = C.parse(doc(...names.map((v) => [v, "2026-01-01"])));
    assert(C.validate(m.releases).every((v) => v.version.length));
  }
});
test("provider parsing, nested GitLab paths and SSH normalization", () => {
  assert.equal(
    C.repository("git@github.com:owner/repo.git").base,
    "https://github.com/owner/repo",
  );
  assert.equal(
    C.repository("https://gitlab.com/team/sub/project.git/").base,
    "https://gitlab.com/team/sub/project",
  );
  assert.equal(
    C.repository("https://code.example.org/team/repo", "gitlab").provider,
    "gitlab",
  );
  assert(C.repository("https://unknown.org/team/repo").error);
  assert(C.repository("javascript:alert(1)").error);
  assert(C.repository("https://user:secret@github.com/o/r").error);
  assert(C.repository("https://github.com/o/r/tree/main").error);
});
test("links for all releases, oldest tag, Unreleased, no duplicate definitions", () => {
  const config = {
    url: "https://github.com/owner/project.git",
    provider: "auto",
    prefix: "v",
    head: "main",
  };
  const source = doc(
    ["Unreleased"],
    ["2.0.0", "2026-09-29"],
    ["1.0.0", "2026-09-28"],
  );
  const result = C.syncLinks(source, config);
  assert(
    result.includes(
      "[Unreleased]: https://github.com/owner/project/compare/v2.0.0...main",
    ),
  );
  assert(
    result.includes(
      "[2.0.0]: https://github.com/owner/project/compare/v1.0.0...v2.0.0",
    ),
  );
  assert(
    result.includes(
      "[1.0.0]: https://github.com/owner/project/releases/tag/v1.0.0",
    ),
  );
  assert(result.includes("[external]: https://example.org"));
  assert.equal(C.syncLinks(result, config), result);
  const gl = C.syncLinks(source, {
    ...config,
    url: "https://gitlab.com/team/sub/repo",
    prefix: "",
  });
  assert(gl.includes("/team/sub/repo/-/compare/1.0.0...2.0.0"));
  assert(gl.includes("/-/tags/1.0.0"));
  assert(gl.includes("/-/compare/2.0.0...main"));
  assert.equal(
    C.syncLinks(doc(["bad", "2026-01-01"]), config),
    doc(["bad", "2026-01-01"]),
  );
});
test("editing before-header refs, inline links and item preservation", () => {
  const source =
    "[2.0.0]: https://example.com\n\n" +
    doc(["2.0.0", "2026-09-29"], ["1.0.0", "2026-09-28"]);
  const result = C.syncLinks(source, {
    url: "https://github.com/o/r",
    provider: "auto",
    prefix: "",
    head: "HEAD",
  });
  assert.equal(C.parse(result).releases.length, 2);
  assert(result.includes("Notes for 2.0.0."));
  assert(
    result.includes("[2.0.0]: https://github.com/o/r/compare/1.0.0...2.0.0"),
  );
  const m = C.parse(
    "## [2.0.0](https://example.com) - 2026-09-29 [YANKED]\n\n### Changed\n\n- **BREAKING:** One\n  two\n  - nested\n",
  );
  assert.equal(m.releases[0].items[0].text, "One\ntwo\n- nested");
  assert(m.releases[0].yanked);
  assert(m.releases[0].items[0].breaking);
});

test("shared custom reference aliases are preserved when generating canonical links", () => {
  const source =
    "## [2.0.0][project] - 2026-09-29\n\n## [1.0.0][project] - 2026-09-28\n\n[project]: https://example.com\n";
  const out = C.syncLinks(source, {
    url: "https://github.com/o/r",
    provider: "auto",
    prefix: "v",
    head: "HEAD",
  });
  assert(out.includes("[project]: https://example.com"));
  assert.equal(C.parse(out).releases.length, 2);
  assert(
    out.includes("[2.0.0]: https://github.com/o/r/compare/v1.0.0...v2.0.0"),
  );
  assert.equal(
    C.syncLinks(out, {
      url: "https://github.com/o/r",
      provider: "auto",
      prefix: "v",
      head: "HEAD",
    }),
    out,
  );
});
test("release definitions are sorted numerically with Unreleased first", () => {
  const source =
    doc(["Unreleased"], ["1.10.0", "2026-09-29"], ["1.9.0", "2026-09-28"]) +
    "[1.9.0]: https://example.com/old\n[Unreleased]: https://example.com/head\n[1.10.0]: https://example.com/new\n";
  const out = C.orderReleaseLinks(source);
  assert.deepEqual(
    C.parse(out)
      .refs.filter((r) => r.key !== "external")
      .map((r) => r.key),
    ["Unreleased", "1.10.0", "1.9.0"],
  );
  assert(out.includes("[external]: https://example.org"));
  assert(out.includes("[1.9.0]: https://example.com/old"));
  assert.equal(C.orderReleaseLinks(out), out);
});
test("new release link is inserted in order and updates both neighboring comparisons", () => {
  const config = {
    url: "https://github.com/o/r",
    provider: "auto",
    prefix: "v",
    head: "HEAD",
  };
  const original = C.syncLinks(
    doc(["Unreleased"], ["2.0.0", "2026-09-29"], ["1.0.0", "2026-09-28"]),
    config,
  );
  const updated = C.syncLinks(C.nextRelease(original, "2026-09-30"), config);
  assert.deepEqual(
    C.parse(updated)
      .refs.filter((r) => r.key !== "external")
      .map((r) => r.key),
    ["Unreleased", "2.0.1", "2.0.0", "1.0.0"],
  );
  assert(
    updated.includes(
      "[Unreleased]: https://github.com/o/r/compare/v2.0.1...HEAD",
    ),
  );
  assert(
    updated.includes("[2.0.1]: https://github.com/o/r/compare/v2.0.0...v2.0.1"),
  );
  assert.equal(C.syncLinks(updated, config), updated);
});
test("import recovers all four settings from generated GitHub reference links", () => {
  const config = {
    url: "https://github.com/owner/project",
    provider: "github",
    prefix: "v",
    head: "main",
  };
  const md = C.syncLinks(
    doc(["Unreleased"], ["2.0.0", "2026-09-29"], ["1.0.0", "2026-09-28"]),
    config,
  );
  const result = C.inferSettings(md);
  assert(result.complete);
  assert.deepEqual(result.settings, config);
});
test("import recognizes nested self-hosted GitLab and decodes slash-containing refs", () => {
  const config = {
    url: "https://code.example.org/team/subgroup/project",
    provider: "gitlab",
    prefix: "release/",
    head: "develop/next",
  };
  const md = C.syncLinks(
    doc(["Unreleased"], ["2.0.0", "2026-09-29"], ["1.0.0", "2026-09-28"]),
    config,
  );
  assert.deepEqual(C.inferSettings(md).settings, config);
  assert(C.inferSettings(md).complete);
});
test("inline compare links infer empty tag prefix and ignore unrelated references", () => {
  const md =
    "## [Unreleased](https://github.com/o/r/compare/1.0.0...HEAD)\n\n## [1.0.0](https://github.com/o/r/releases/tag/1.0.0) - 2026-09-29\n\n[docs]: https://github.com/other/project\n";
  const result = C.inferSettings(md);
  assert(result.complete);
  assert.deepEqual(result.settings, {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "",
    head: "HEAD",
  });
});
test("missing Unreleased link does not invent a branch", () => {
  const result = C.inferSettings(
    "## [1.0.0] - 2026-09-29\n\n[1.0.0]: https://github.com/o/r/releases/tag/v1.0.0\n",
  );
  assert(!result.complete);
  assert.equal(result.settings.head, "");
  assert.equal(result.settings.prefix, "v");
  assert(result.message.includes("Unreleased ref"));
});
test("Unreleased settings take precedence over conflicting older release links", () => {
  const conflicts = [
    "## [Unreleased](https://github.com/a/r/compare/v1.0.0...HEAD)\n\n## [1.0.0](https://github.com/b/r/releases/tag/v1.0.0) - 2026-09-29\n",
    "## [Unreleased](https://github.com/a/r/compare/v1.0.0...HEAD)\n\n## [1.0.0](https://github.com/a/r/releases/tag/release-1.0.0) - 2026-09-29\n",
  ];
  for (const md of conflicts) {
    const result = C.inferSettings(md);
    assert(result.complete);
    assert.deepEqual(result.settings, {
      url: "https://github.com/a/r",
      provider: "github",
      prefix: "v",
      head: "HEAD",
    });
  }
});
test("Markdown reference titles and legacy v-prefixed headings can be inferred", () => {
  const md =
    '## [Unreleased]\n\n## [v1.0.0] - 2026-09-29\n\n[Unreleased]: <https://github.com/o/r/compare/v1.0.0...main> "Changes"\n[v1.0.0]: https://github.com/o/r/releases/tag/v1.0.0 "Release"\n';
  const result = C.inferSettings(md);
  assert(result.complete);
  assert.equal(result.settings.prefix, "v");
  assert.equal(result.settings.head, "main");
  assert(!C.inferSettings("# Changelog\n").complete);
});
test("rebuild fixes screenshot scenario and removes stale definitions", () => {
  const source =
    "## [Unreleased]\n\n## [0.1.0] - 2026-08-30 [YANKED]\n\n[unreleased]: https://github.com/example/project/compare/v1.2.0...HEAD\n[1.2.0]: https://github.com/example/project/releases/tag/v1.2.0\n[docs]: https://example.org/help\n";
  const inferred = C.inferSettings(source);
  assert(inferred.complete);
  const result = C.syncLinks(source, inferred.settings);
  assert.deepEqual(
    C.parse(result).refs.map((r) => r.key),
    ["docs", "Unreleased", "0.1.0"],
  );
  assert(
    result.includes(
      "[Unreleased]: https://github.com/example/project/compare/v0.1.0...HEAD",
    ),
  );
  assert(
    result.includes(
      "[0.1.0]: https://github.com/example/project/releases/tag/v0.1.0",
    ),
  );
  assert(!result.includes("v1.2.0"));
});
test("full rebuild after deletion updates latest, middle and oldest targets", () => {
  const config = {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "v",
    head: "main",
  };
  const original = C.syncLinks(
    doc(
      ["Unreleased"],
      ["3.0.0", "2026-09-29"],
      ["2.0.0", "2026-09-28"],
      ["1.0.0", "2026-09-27"],
    ),
    config,
  );
  for (const version of ["3.0.0", "2.0.0", "1.0.0"]) {
    const r = C.parse(original).releases.find((r) => r.version === version);
    const result = C.syncLinks(
      C.replace(original, r.start, r.end, ""),
      config,
      original,
    );
    const rs = C.parse(result).releases,
      refs = C.parse(result).refs.filter((r) => r.key !== "external");
    assert.deepEqual(
      refs.map((r) => r.key),
      rs.map((r) => r.version),
    );
    assert(!result.includes("v" + version));
    assert.equal(C.syncLinks(result, config, result), result);
    if (version === "2.0.0")
      assert(result.includes("/compare/v1.0.0...v3.0.0"));
    if (version === "1.0.0") assert(result.includes("/releases/tag/v2.0.0"));
    if (version === "3.0.0") assert(result.includes("/compare/v2.0.0...main"));
  }
});
test("rebuild removes duplicate definitions and handles removal of every release", () => {
  const config = {
    url: "https://gitlab.com/o/r",
    provider: "gitlab",
    prefix: "",
    head: "HEAD",
  };
  const original = C.syncLinks(
    doc(["Unreleased"], ["1.0.0", "2026-09-29"]),
    config,
  );
  const duplicate = original + "[1.0.0]: https://old.example/duplicate\n";
  assert.equal(
    C.parse(C.syncLinks(duplicate, config)).refs.filter(
      (r) => r.key === "1.0.0",
    ).length,
    1,
  );
  let none = original;
  for (const r of [...C.parse(original).releases].reverse())
    none = C.replace(none, r.start, r.end, "");
  const out = C.syncLinks(none, config, original);
  assert.deepEqual(
    C.parse(out).refs.map((r) => r.key),
    ["external"],
  );
  assert(!out.includes("/compare/"));
});
test("standalone Unreleased definition supplies all repository settings", () => {
  const md =
    "## [0.1.0] - 2026-08-30\n\n[unreleased]: https://gitlab.example.org/team/sub/repo/-/compare/release%2F0.1.0...develop%2Fnext\n";
  const r = C.inferSettings(md);
  assert(r.complete);
  assert.deepEqual(r.settings, {
    url: "https://gitlab.example.org/team/sub/repo",
    provider: "gitlab",
    prefix: "release/",
    head: "develop/next",
  });
});
test("inconsistent duplicate Unreleased links remain an explicit error", () => {
  const md =
    "## [Unreleased]\n\n[Unreleased]: https://github.com/a/r/compare/v1.0.0...main\n[unreleased]: https://github.com/a/r/compare/v1.0.0...develop\n";
  const r = C.inferSettings(md);
  assert(!r.complete);
  assert.equal(r.settings, null);
  assert(r.message.includes("disagree"));
});
test("repository settings persist and restore including empty prefixes", () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    };
  const config = {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "",
    head: "main",
  };
  assert(C.saveSettings(storage, config));
  assert.deepEqual(C.readSavedSettings(storage), config);
  assert(!C.saveSettings(storage, { ...config, url: "not a URL" }));
  assert.deepEqual(C.readSavedSettings(storage), config);
  assert(C.saveSettings(storage, null));
  assert.equal(C.readSavedSettings(storage), null);
});
test("blocked or corrupt browser storage does not break editing", () => {
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(C.readSavedSettings(blocked), null);
  assert.equal(
    C.saveSettings(blocked, {
      url: "https://github.com/o/r",
      provider: "github",
      prefix: "v",
      head: "HEAD",
    }),
    false,
  );
  assert.equal(C.readSavedSettings({ getItem: () => "{broken" }), null);
  assert.equal(
    C.readSavedSettings({ getItem: () => JSON.stringify({ url: 12 }) }),
    null,
  );
});
test("Security CVE metadata round-trips with canonical Breaking marker", () => {
  const source =
    "## [1.0.0] - 2026-09-29\n\n### Security\n\n- CVE-2026-12345: **Breaking:** Reject unsafe input.\n";
  const item = C.parse(source).releases[0].items[0];
  assert.equal(item.cve, "CVE-2026-12345");
  assert(item.breaking);
  assert.equal(item.text, "Reject unsafe input.");
  assert.equal(
    C.itemMarkdown(item),
    "- CVE-2026-12345: **Breaking:** Reject unsafe input.",
  );
  assert.equal(
    C.itemMarkdown({ ...item, cve: "" }),
    "- **Breaking:** Reject unsafe input.",
  );
});
test("Security CVE can follow a legacy breaking marker and supports long IDs", () => {
  const parsed = C.parseItemContent(
    "**BREAKING:** CVE-2026-1234567: Upgrade now.",
    "Security",
  );
  assert.equal(parsed.cve, "CVE-2026-1234567");
  assert(parsed.breaking);
  assert.equal(
    C.itemMarkdown(parsed),
    "- CVE-2026-1234567: **Breaking:** Upgrade now.",
  );
  assert(C.CVE_ID.test("CVE-2026-0001"));
  assert(!C.CVE_ID.test("CVE-2026-123"));
  assert(!C.CVE_ID.test("CVE-26-12345"));
  assert.equal(C.parseItemContent("Fix a vulnerability.", "Security").cve, "");
});

test("Create release moves complete Unreleased body and rebuilds comparisons", () => {
  const config = {
    url: "https://github.com/o/r",
    provider: "github",
    prefix: "v",
    head: "main",
  };
  const body =
    "\nRelease summary.\n\n### Security\n\n- CVE-2026-12345: **Breaking:** Fix authentication\n  - Nested detail\n\n### Custom notes\n\nPreserve this prose.\n\n";
  const source = C.syncLinks(
    "# Changelog\n\n## [Unreleased]\n" +
      body +
      "## [0.1.0] - 2026-10-01\n\n### Added\n\n- Initial release\n\n",
    config,
  );
  const out = C.syncLinks(
      C.createRelease(source, "2026-09-29"),
      config,
      source,
    ),
    rs = C.parse(out).releases;
  assert.deepEqual(
    rs.map((r) => r.version),
    ["Unreleased", "0.1.1", "0.1.0"],
  );
  assert.equal(rs[0].items.length, 0);
  assert.equal(out.slice(rs[0].headEnd, rs[0].end).trim(), "");
  assert.equal(out.slice(rs[1].headEnd, rs[1].end), body);
  assert.equal(rs[1].date, "2026-10-01");
  assert.equal(rs[1].items[0].cve, "CVE-2026-12345");
  assert(rs[1].items[0].breaking);
  assert.equal(rs[2].items[0].text, "Initial release");
  assert(
    out.includes("[Unreleased]: https://github.com/o/r/compare/v0.1.1...main"),
  );
  assert(
    out.includes("[0.1.1]: https://github.com/o/r/compare/v0.1.0...v0.1.1"),
  );
  assert(C.validate(rs).every((v) => !v.version.length && !v.date.length));
});
test("Create release supports empty or sole Unreleased and rejects duplicates", () => {
  const out = C.createRelease(
    "## [Unreleased]\n\n[Unreleased]: https://github.com/o/r/commits/main\n",
    "2026-09-29",
  );
  assert.deepEqual(
    C.parse(out).releases.map((r) => r.version),
    ["Unreleased", "0.1.0"],
  );
  assert(out.includes("[Unreleased]: https://github.com/o/r/commits/main"));
  assert.throws(
    () => C.createRelease("## [Unreleased]\n\n## [Unreleased]\n", "2026-09-29"),
    /exactly one/,
  );
  assert.throws(
    () => C.createRelease("# Changelog\n", "2026-09-29"),
    /exactly one/,
  );
});
test("imported YANKED Unreleased is invalid", () => {
  const rs = C.parse("## [Unreleased] [YANKED]\n").releases;
  assert(C.validate(rs)[0].version.some((e) => e.includes("cannot be YANKED")));
});
