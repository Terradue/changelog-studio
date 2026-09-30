/* Source-range editing preserves unrelated Markdown verbatim. */
(function (root) {
  const TYPES = [
    "Added",
    "Changed",
    "Deprecated",
    "Removed",
    "Fixed",
    "Security",
  ];
  function parse(text) {
    const lines = [];
    let offset = 0,
      fence = null;
    for (const raw of text.split(/(?<=\n)/)) {
      const value = raw.replace(/\r?\n$/, "");
      const fm = value.match(/^\s{0,3}(`{3,}|~{3,})/);
      let code = !!fence;
      if (fm) {
        if (!fence) {
          fence = fm[1];
          code = true;
        } else if (fm[1][0] === fence[0] && fm[1].length >= fence.length) {
          fence = null;
          code = true;
        }
      }
      lines.push({
        text: value,
        start: offset,
        end: offset + raw.length,
        code,
      });
      offset += raw.length;
    }
    const refs = lines
      .filter((l) => !l.code && /^\s{0,3}\[[^\]]+\]:\s*\S/.test(l.text))
      .map((l) => {
        const m = l.text.match(/^\s{0,3}\[([^\]]+)\]:\s*(.*)$/);
        return { ...l, key: m[1], url: m[2] };
      });
    const releases = [];
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      if (l.code) continue;
      const h = l.text.match(
        /^##\s+(?:\[([^\]]*)\](?:\((.*?)\)|\[([^\]]*)\])?|([^\s\[]+))(.*)$/,
      );
      if (!h) continue;
      const version = h[1] ?? h[4];
      const refkey = h[3] || version;
      const ref = refs.find(
        (r) => r.key.toLowerCase() === refkey.toLowerCase(),
      );
      releases.push({
        start: l.start,
        headEnd: l.end,
        line: i,
        version,
        date: h[5]
          .replace(/\[YANKED\]/gi, "")
          .replace(/^\s*-\s*/, "")
          .trim(),
        yanked: /\[YANKED\]/i.test(h[5]),
        link: h[2] ?? ref?.url ?? "",
        inline: h[2] !== undefined,
        refkey,
        bracket: h[1] !== undefined,
        ref,
        items: [],
        sections: [],
      });
    }
    for (let n = 0; n < releases.length; n++) {
      const r = releases[n];
      r.end = releases[n + 1]?.start ?? text.length;
      // A terminal reference block belongs to the document, not the last release.
      const tail = refs.find(
        (ref) =>
          ref.start >= r.headEnd &&
          ref.start < r.end &&
          text
            .slice(ref.start, r.end)
            .split(/\r?\n/)
            .every((x) => !x.trim() || /^\s{0,3}\[[^\]]+\]:/.test(x)),
      );
      if (tail) r.end = tail.start;
      let section = null,
        item = null;
      const finish = (end) => {
        if (!item) return;
        let raw = text
          .slice(item.contentStart, end)
          .replace(/(?:\r?\n[ \t]*)+$/, "");
        item.end = item.contentStart + raw.length;
        Object.assign(item, parseItemContent(raw, item.type));
        r.items.push(item);
        item = null;
      };
      for (const l of lines) {
        if (l.start < r.headEnd || l.start >= r.end) continue;
        if (l.code) continue;
        const sh = l.text.match(/^###\s+(.+?)\s*#*$/);
        if (sh) {
          finish(l.start);
          if (section) section.end = l.start;
          section = { name: sh[1], start: l.start, headEnd: l.end, end: r.end };
          r.sections.push(section);
          continue;
        }
        if (/^#{1,6}\s|^\s{0,3}\[[^\]]+\]:/.test(l.text)) {
          finish(l.start);
          if (section) section.end = l.start;
          section = null;
          continue;
        }
        const bullet = l.text.match(/^[-*+]\s+(.*)$/);
        if (bullet && section && TYPES.includes(section.name)) {
          finish(l.start);
          item = {
            start: l.start,
            contentStart: l.start + l.text.indexOf(bullet[1], 2),
            type: section.name,
          };
          if (!bullet[1]) item.contentStart = l.start + 2;
          continue;
        }
        if (item && l.text.trim() && !/^\s/.test(l.text)) {
          finish(l.start);
        }
      }
      finish(r.end);
    }
    return { releases, refs };
  }
  function replace(text, start, end, value) {
    return text.slice(0, start) + value + text.slice(end);
  }
  function heading(r) {
    const label = r.inline
      ? `[${r.version}](${r.link})`
      : r.bracket || r.link
        ? `[${r.version}]${r.refkey && r.refkey !== r.version ? "[" + r.refkey + "]" : ""}`
        : r.version;
    return `## ${label}${r.date ? " - " + r.date : ""}${r.yanked ? " [YANKED]" : ""}\n`;
  }
  const BREAKING =
    /^(?:\*\*BREAKING(?: CHANGE)?:\*\*|\*\*BREAKING(?: CHANGE)?\*\*:|BREAKING(?: CHANGE)?:)[ \t]*/i;
  const CVE_ID = /^CVE-\d{4}-\d{4,}$/i;
  function parseItemContent(raw, type) {
    let text = raw,
      breaking = false,
      cve = "";
    if (BREAKING.test(text)) {
      breaking = true;
      text = text.replace(BREAKING, "");
    }
    if (type === "Security") {
      const match = text.match(/^(CVE-\d{4}-\d{4,}):[ \t]*/i);
      if (match) {
        cve = match[1].toUpperCase();
        text = text.slice(match[0].length);
      }
    }
    if (BREAKING.test(text)) {
      breaking = true;
      text = text.replace(BREAKING, "");
    }
    return { text: text.replace(/\n {2}/g, "\n"), breaking, cve };
  }
  function itemMarkdown(item) {
    return (
      "- " +
      (item.cve ? item.cve.toUpperCase() + ": " : "") +
      (item.breaking ? "**Breaking:** " : "") +
      item.text.replace(/\n/g, "\n  ")
    );
  }
  function appendItem(text, index, item) {
    const r = parse(text).releases[index];
    const section = r.sections.find((s) => s.name === item.type);
    const at = section ? section.end : r.end;
    const before = text.slice(0, at);
    const prefix = before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
    return replace(
      text,
      at,
      at,
      prefix +
        (section ? "" : `### ${item.type}\n\n`) +
        itemMarkdown(item) +
        "\n\n",
    );
  }
  function removeItem(text, index, itemIndex) {
    const r = parse(text).releases[index],
      item = r.items[itemIndex];
    const section = r.sections.find(
      (s) => item.start >= s.start && item.start < s.end,
    );
    if (
      section &&
      r.items.filter((x) => x.start >= section.start && x.start < section.end)
        .length === 1 &&
      !replace(
        text.slice(section.headEnd, section.end),
        item.start - section.headEnd,
        item.end - section.headEnd,
        "",
      ).trim()
    )
      return replace(text, section.start, section.end, "");
    return replace(text, item.start, item.end, "");
  }
  root.Changelog = {
    TYPES,
    parse,
    replace,
    heading,
    itemMarkdown,
    appendItem,
    removeItem,
    parseItemContent,
    CVE_ID,
  };
  if (typeof module !== "undefined") module.exports = root.Changelog;
})(typeof window !== "undefined" ? window : globalThis);
