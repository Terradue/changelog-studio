/* SemVer 2.0.0 regex and precedence rules: https://semver.org/ (CC BY 3.0). */
(function (root) {
  const C = root.Changelog;
  const SEMVER =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  const unreleased = (v) => /^unreleased$/i.test(v);
  const semver = (v) =>
    typeof v === "string" && !/[\r\n]/.test(v) ? SEMVER.exec(v) : null;
  function cmp(a, b) {
    const x = semver(a),
      y = semver(b);
    if (!x || !y) throw Error("Cannot compare invalid versions");
    for (let i = 1; i <= 3; i++) {
      if (BigInt(x[i]) !== BigInt(y[i]))
        return BigInt(x[i]) > BigInt(y[i]) ? 1 : -1;
    }
    if (x[4] === y[4]) return 0;
    if (!x[4]) return 1;
    if (!y[4]) return -1;
    const p = x[4].split("."),
      q = y[4].split(".");
    for (let i = 0; i < Math.max(p.length, q.length); i++) {
      if (p[i] === undefined) return -1;
      if (q[i] === undefined) return 1;
      if (p[i] === q[i]) continue;
      const pn = /^\d+$/.test(p[i]),
        qn = /^\d+$/.test(q[i]);
      if (pn && qn) return BigInt(p[i]) > BigInt(q[i]) ? 1 : -1;
      if (pn !== qn) return pn ? -1 : 1;
      return p[i] > q[i] ? 1 : -1;
    }
    return 0;
  }
  function validDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const y = +m[1],
      mo = +m[2],
      d = +m[3],
      days = [
        31,
        y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ];
    return y > 0 && mo > 0 && mo <= 12 && d > 0 && d <= days[mo - 1];
  }
  function validate(releases) {
    return releases.map((r, i) => {
      const ve = [],
        de = [],
        future = releases.slice(0, i).filter((x) => !unreleased(x.version)),
        past = releases.slice(i + 1).filter((x) => !unreleased(x.version));
      if (unreleased(r.version)) {
        if (releases.filter((x) => unreleased(x.version)).length > 1)
          ve.push("Only one Unreleased section is allowed.");
        if (i !== 0) ve.push("Unreleased must be the first release.");
        if (r.yanked)
          ve.push("Unreleased cannot be YANKED. Remove [YANKED] in Markdown.");
        if (r.date) de.push("Unreleased must not have a release date.");
        return { version: ve, date: de, min: "", max: "" };
      }
      if (!semver(r.version))
        ve.push(
          "Use SemVer: MAJOR.MINOR.PATCH, e.g. 1.2.3 or 2.0.0-rc.1. No “v” prefix or leading zeroes.",
        );
      else {
        const older = past.find(
            (x) => semver(x.version) && cmp(r.version, x.version) <= 0,
          ),
          newer = future.find(
            (x) => semver(x.version) && cmp(r.version, x.version) >= 0,
          );
        if (older)
          ve.push(
            `Must be greater than ${older.version} below (build metadata does not change precedence).`,
          );
        if (newer)
          ve.push(
            `Must be lower than ${newer.version} above (build metadata does not change precedence).`,
          );
      }
      const min =
          past
            .map((x) => x.date)
            .filter(validDate)
            .sort()
            .at(-1) || "",
        max =
          future
            .map((x) => x.date)
            .filter(validDate)
            .sort()[0] || "";
      if (!validDate(r.date))
        de.push(
          r.date
            ? `Invalid date “${r.date}”. Use a real calendar date in YYYY-MM-DD format.`
            : "A release date is required.",
        );
      else {
        if (min && r.date < min)
          de.push(
            `Must be on or after ${min}, the latest date among older releases.`,
          );
        if (max && r.date > max)
          de.push(
            `Must be on or before ${max}, the earliest date among newer releases.`,
          );
      }
      if (min && max && min > max)
        de.push(
          "Dates above and below conflict. Correct those releases first.",
        );
      return { version: ve, date: de, min, max };
    });
  }
  function patches(text, edits) {
    for (const e of [...edits].sort((a, b) => b.start - a.start))
      text = C.replace(text, e.start, e.end, e.value);
    return text;
  }
  function pin(text) {
    const rs = C.parse(text).releases;
    if (!rs.length) return text;
    const moving = rs.filter((r, i) => unreleased(r.version) && i > 0);
    if (!moving.length) return text;
    let chunks = "";
    for (const r of moving)
      chunks += text.slice(r.start, r.end).replace(/\s*$/, "") + "\n\n";
    text = patches(
      text,
      moving.map((r) => ({ start: r.start, end: r.end, value: "" })),
    );
    return C.replace(text, rs[0].start, rs[0].start, chunks);
  }
  function nextRelease(text, today) {
    text = pin(text);
    const rs = C.parse(text).releases;
    const valid = rs.filter((r) => semver(r.version));
    const top = valid.reduce(
      (best, r) => (!best || cmp(r.version, best.version) > 0 ? r : best),
      null,
    );
    let version = "0.1.0";
    if (top) {
      const m = semver(top.version);
      version = m[4]
        ? `${m[1]}.${m[2]}.${m[3]}`
        : `${m[1]}.${m[2]}.${BigInt(m[3]) + 1n}`;
    }
    const date = [
      today,
      ...rs
        .filter((r) => !unreleased(r.version))
        .map((r) => r.date)
        .filter(validDate),
    ]
      .sort()
      .at(-1);
    const us = rs.filter((r) => unreleased(r.version));
    const at = us.length ? us.at(-1).end : (rs[0]?.start ?? text.length);
    const prefix = at && !text.slice(0, at).endsWith("\n\n") ? "\n\n" : "";
    return C.replace(text, at, at, `${prefix}## [${version}] - ${date}\n\n`);
  }
  function createRelease(text, today) {
    text = pin(text);
    const us = C.parse(text).releases.filter((r) => unreleased(r.version));
    if (us.length !== 1)
      throw Error(
        "Keep exactly one Unreleased section before creating a release.",
      );
    const source = us[0],
      body = text.slice(source.headEnd, source.end);
    // Transfer source verbatim so custom sections, nested lists and metadata survive.
    const cleared = C.replace(text, source.headEnd, source.end, "\n");
    const added = nextRelease(cleared, today),
      target = C.parse(added).releases.find((r) => !unreleased(r.version));
    return C.replace(
      added,
      target.headEnd,
      target.end,
      body.trim() ? body.replace(/\s*$/, "") + "\n\n" : "\n",
    );
  }
  function repository(raw, provider = "auto") {
    let input = raw.trim();
    if (!input)
      return { error: "Enter a repository URL to generate release links." };
    input = input
      .replace(/^git@([^:]+):/, "https://$1/")
      .replace(/^ssh:\/\/(?:git@)?/, "https://");
    let url;
    try {
      url = new URL(input);
    } catch {
      return {
        error:
          "Enter a complete repository URL, such as https://github.com/owner/project.",
      };
    }
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return {
        error:
          "Use an HTTP(S) repository URL without credentials, query parameters, or fragments.",
      };
    let path = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length < 2 || parts.some((p) => /\s|[<>\[\]()]/.test(p)))
      return { error: "Include the repository owner/group and project name." };
    if (provider === "auto") {
      if (url.hostname === "github.com" || url.hostname === "www.github.com")
        provider = "github";
      else if (
        url.hostname === "gitlab.com" ||
        /(^|\.)gitlab\./.test(url.hostname)
      )
        provider = "gitlab";
      else
        return {
          error:
            "This host is not recognized. Choose GitHub or GitLab for a self-hosted repository.",
        };
    }
    if (!["github", "gitlab"].includes(provider))
      return { error: "Choose a supported hosting provider." };
    if (provider === "github" && parts.length !== 2)
      return {
        error: "Use the GitHub repository root: https://host/owner/repository.",
      };
    if (parts.includes("-"))
      return {
        error:
          "Use the repository root, without /-/compare or another page suffix.",
      };
    return { base: url.origin + path, provider };
  }
  function configError(config) {
    const repo = repository(config.url, config.provider);
    if (repo.error) return repo.error;
    if (/[\s~^:?*\[\]\\]|\.\.|@\{|\/\/|^\//.test(config.prefix))
      return "The tag prefix contains characters that Git refs do not allow.";
    if (
      !config.head ||
      /[\s~^:?*\[\]\\]|\.\.|@\{|\/\/|^\/|\/$/.test(config.head)
    )
      return "Enter a valid branch or ref for Unreleased, such as HEAD or main.";
    return "";
  }
  function releaseLink(repo, current, previous, config) {
    const encode = (s) => encodeURIComponent(s),
      tag = (v) => encode(config.prefix + v),
      head = encode(config.head);
    if (unreleased(current)) {
      if (!previous)
        return repo.provider === "github"
          ? `${repo.base}/commits/${head}`
          : `${repo.base}/-/commits/${head}`;
      return repo.provider === "github"
        ? `${repo.base}/compare/${tag(previous)}...${head}`
        : `${repo.base}/-/compare/${tag(previous)}...${head}`;
    }
    if (!previous)
      return repo.provider === "github"
        ? `${repo.base}/releases/tag/${tag(current)}`
        : `${repo.base}/-/tags/${tag(current)}`;
    return repo.provider === "github"
      ? `${repo.base}/compare/${tag(previous)}...${tag(current)}`
      : `${repo.base}/-/compare/${tag(previous)}...${tag(current)}`;
  }
  // Only release-heading links are evidence; unrelated project/docs links are ignored.
  function inferSettings(text) {
    const model = C.parse(text),
      rs = model.releases,
      found = [],
      unsupported = [];
    const candidates = [
      ...rs,
      ...model.refs
        .filter(
          (ref) =>
            unreleased(ref.key) && !rs.some((r) => r.ref?.start === ref.start),
        )
        .map((ref) => ({ version: "Unreleased", link: ref.url })),
    ];
    const versionOf = (v) =>
      semver(v)
        ? v
        : v.startsWith("v") && semver(v.slice(1))
          ? v.slice(1)
          : null;
    const prefixOf = (tag, version) =>
      version && tag.endsWith(version) ? tag.slice(0, -version.length) : null;
    for (const r of candidates) {
      if (!r.link) continue;
      const raw = r.link.match(/^<?(https?:\/\/[^\s>]+)>?(?:\s+.*)?$/i)?.[1];
      let url;
      try {
        url = new URL(raw);
      } catch {
        unsupported.push(r.version);
        continue;
      }
      if (url.username || url.password) {
        unsupported.push(r.version);
        continue;
      }
      let match = url.pathname.match(
          /^(\/.+)\/-\/(compare|tags|commits)\/(.+)$/,
        ),
        provider = "gitlab";
      if (!match) {
        match = url.pathname.match(
          /^(\/[^/]+\/[^/]+)\/(compare|releases\/tag|commits)\/(.+)$/,
        );
        provider = "github";
      }
      if (!match) {
        unsupported.push(r.version);
        continue;
      }
      const repo = repository(url.origin + match[1], provider);
      if (repo.error) {
        unsupported.push(r.version);
        continue;
      }
      let ref;
      try {
        ref = decodeURIComponent(match[3]);
      } catch {
        unsupported.push(r.version);
        continue;
      }
      const entry = {
        repo: repo.base,
        provider,
        prefixes: [],
        head: null,
        isUnreleased: unreleased(r.version),
      };
      if (match[2] === "compare") {
        const parts = ref.match(/^(.+?)\.{2,3}(.+)$/);
        if (!parts) {
          unsupported.push(r.version);
          continue;
        }
        const [base, current] = parts.slice(1);
        if (unreleased(r.version)) {
          entry.head = current;
          const matches = rs
            .filter((x) => !unreleased(x.version))
            .map((x) => prefixOf(base, versionOf(x.version)))
            .filter((x) => x !== null);
          if (matches.length)
            entry.prefixes.push(matches.sort((a, b) => a.length - b.length)[0]);
          else {
            const m = base.match(
              /^(.*?)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/,
            );
            if (m && semver(m[2])) entry.prefixes.push(m[1]);
          }
        } else {
          const prefix = prefixOf(current, versionOf(r.version));
          if (prefix === null) {
            unsupported.push(r.version);
            continue;
          }
          entry.prefixes.push(prefix);
          if (!base.startsWith(prefix) || !semver(base.slice(prefix.length))) {
            unsupported.push(r.version);
            continue;
          }
        }
      } else if (match[2] === "commits") {
        if (!unreleased(r.version)) {
          unsupported.push(r.version);
          continue;
        }
        entry.head = ref;
      } else {
        const prefix = prefixOf(ref, versionOf(r.version));
        if (prefix === null) {
          unsupported.push(r.version);
          continue;
        }
        entry.prefixes.push(prefix);
      }
      found.push(entry);
    }
    const unique = (a) => [...new Set(a)];
    const primary = found.filter(
      (x) => x.isUnreleased && x.head !== null && x.prefixes.length,
    );
    if (primary.length) {
      const values = primary.map((x) => ({
        url: x.repo,
        provider: x.provider,
        prefix: x.prefixes[0],
        head: x.head,
      }));
      if (unique(values.map((x) => JSON.stringify(x))).length > 1)
        return {
          settings: null,
          complete: false,
          message:
            "Unreleased links disagree. Correct them or enter repository settings manually.",
        };
      const settings = values[0],
        error = configError(settings);
      return {
        settings,
        complete: !error,
        message: error
          ? `Unreleased settings need correction: ${error}`
          : "Repository settings detected from the Unreleased link and retained for future edits.",
      };
    }
    const repos = unique(found.map((x) => x.repo)),
      providers = unique(found.map((x) => x.provider)),
      prefixes = unique(found.flatMap((x) => x.prefixes)),
      heads = unique(found.map((x) => x.head).filter((x) => x !== null));
    if (
      repos.length > 1 ||
      providers.length > 1 ||
      prefixes.length > 1 ||
      heads.length > 1
    )
      return {
        settings: null,
        complete: false,
        message:
          "Release links disagree about the repository, tag prefix, or Unreleased ref. Enter the settings manually; imported URLs are preserved.",
      };
    if (!found.length)
      return {
        settings: null,
        complete: false,
        message:
          "No supported release links found. Enter the repository settings to enable automatic links.",
      };
    const settings = {
      url: repos[0],
      provider: providers[0],
      prefix: prefixes[0] ?? "",
      head: heads[0] ?? "",
    };
    const missing = [];
    if (!prefixes.length) missing.push("tag prefix");
    if (!heads.length) missing.push("Unreleased ref");
    const error = configError(settings),
      complete = !missing.length && !unsupported.length && !error;
    return {
      settings,
      complete,
      message: complete
        ? "Repository settings detected from imported release links."
        : unsupported.length
          ? "Some release links could not be interpreted. Detected fields are filled; review the settings before editing. Imported URLs are preserved."
          : missing.length
            ? `Detected repository settings. Could not infer ${missing.join(" and ")}; enter the missing setting to enable automatic links.`
            : `Detected settings need correction: ${error}`,
    };
  }
  function orderReleaseLinks(text) {
    const model = C.parse(text),
      versions = new Map(
        model.releases.map((r) => [r.refkey.toLowerCase(), r.version]),
      );
    const refs = model.refs.filter((ref) =>
      versions.has(ref.key.toLowerCase()),
    );
    if (!refs.length) return text;
    refs.sort((a, b) => {
      const av = versions.get(a.key.toLowerCase()),
        bv = versions.get(b.key.toLowerCase());
      if (unreleased(av) !== unreleased(bv)) return unreleased(av) ? -1 : 1;
      if (semver(av) && semver(bv)) return -cmp(av, bv);
      return 0;
    });
    const definitions = refs.map((ref) =>
      text.slice(ref.start, ref.end).replace(/\r?\n$/, ""),
    );
    text = patches(
      text,
      refs.map((ref) => ({ start: ref.start, end: ref.end, value: "" })),
    );
    return text.replace(/\s*$/, "") + "\n\n" + definitions.join("\n") + "\n";
  }
  function syncLinks(text, config, previousText = "") {
    if (!config || configError(config)) return orderReleaseLinks(text);
    const model = C.parse(text),
      rs = model.releases;
    if (validate(rs).some((e) => e.version.length))
      return orderReleaseLinks(text);
    const repo = repository(config.url, config.provider),
      edits = [],
      defs = [];
    const releaseKeys = new Set(
      [...rs, ...C.parse(previousText).releases].map((r) =>
        r.version.toLowerCase(),
      ),
    );
    // Rebuild the complete managed list, including removal of stale and duplicate keys.
    for (const ref of model.refs) {
      const key = ref.key.toLowerCase();
      if (
        releaseKeys.has(key) ||
        unreleased(ref.key) ||
        semver(ref.key) ||
        (/^v/.test(ref.key) && semver(ref.key.slice(1)))
      )
        edits.push({ start: ref.start, end: ref.end, value: "" });
    }
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i],
        older = rs.slice(i + 1).find((x) => !unreleased(x.version));
      const url = releaseLink(repo, r.version, older?.version, config);
      edits.push({
        start: r.start,
        end: r.headEnd,
        value: C.heading({
          ...r,
          inline: false,
          bracket: true,
          refkey: r.version,
          link: url,
        }),
      });
      defs.push(`[${r.version}]: ${url}`);
    }
    text = patches(text, edits).replace(/\s*$/, "");
    return (
      text + (defs.length ? "\n\n" + defs.join("\n") + "\n" : text ? "\n" : "")
    );
  }
  const SETTINGS_KEY = "changelog-studio.repository-settings.v1";
  function readSavedSettings(storage) {
    try {
      const config = JSON.parse(storage.getItem(SETTINGS_KEY));
      return config &&
        ["url", "provider", "prefix", "head"].every(
          (k) => typeof config[k] === "string",
        ) &&
        !configError(config)
        ? config
        : null;
    } catch {
      return null;
    }
  }
  function saveSettings(storage, config) {
    try {
      if (config === null) {
        storage.removeItem(SETTINGS_KEY);
        return true;
      }
      if (configError(config)) return false;
      storage.setItem(SETTINGS_KEY, JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  }
  Object.assign(C, {
    SEMVER,
    unreleased,
    semver,
    cmp,
    validDate,
    validate,
    patches,
    pin,
    nextRelease,
    createRelease,
    repository,
    configError,
    releaseLink,
    syncLinks,
    orderReleaseLinks,
    inferSettings,
    readSavedSettings,
    saveSettings,
  });
})(typeof window !== "undefined" ? window : globalThis);
