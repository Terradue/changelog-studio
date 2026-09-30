"use strict";
const C = require("../media/engine.js");
require("../media/rules.js");
function minimalEdit(before, after) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let a = before.length,
    b = after.length;
  while (a > start && b > start && before[a - 1] === after[b - 1]) {
    a--;
    b--;
  }
  return { start, end: a, text: after.slice(start, b) };
}
function sample(config, date) {
  return C.syncLinks(
    `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/),\nand this project adheres to [Semantic Versioning](https://semver.org/).\n\n## [Unreleased]\n\n## [0.1.0] - ${date}\n\n### Added\n\n- Initial release\n`,
    config,
  );
}
function gitRepository(repos, uri) {
  return repos
    .filter(
      (r) =>
        uri.scheme === r.rootUri.scheme &&
        uri.authority === r.rootUri.authority &&
        (uri.path === r.rootUri.path ||
          uri.path.startsWith(r.rootUri.path.replace(/\/$/, "") + "/")),
    )
    .sort((a, b) => b.rootUri.path.length - a.rootUri.path.length)[0];
}
function remoteUrl(repo) {
  const rs = repo?.state.remotes || [];
  const remote =
    rs.find((r) => r.name === repo.state.HEAD?.upstream?.remote) ||
    rs.find((r) => r.name === "origin") ||
    rs[0];
  return remote?.fetchUrl || remote?.pushUrl || null;
}
function settingsFrom(text, remote, fallback) {
  const inferred = C.inferSettings(text);
  let config = inferred.complete ? inferred.settings : fallback;
  if (!config) return null;
  if (remote) {
    const detected = C.repository(remote);
    const repo = detected.error ? C.repository(remote, config.provider) : detected;
    if (!repo.error)
      config = { ...config, url: repo.base, provider: repo.provider };
  }
  return C.configError(config) ? null : config;
}
module.exports = {
  C,
  minimalEdit,
  sample,
  gitRepository,
  remoteUrl,
  settingsFrom,
};
