const {
  TYPES,
  parse,
  replace,
  heading,
  itemMarkdown,
  appendItem,
  removeItem,
  unreleased,
  semver,
  validDate,
  validate,
  patches,
  pin,
  nextRelease,
  repository,
  configError,
  syncLinks,
  inferSettings,
} = Changelog;
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const vscode = acquireVsCodeApi();
let text = "",
  model,
  validation,
  activeConfig = null,
  version = 0,
  inflight = null,
  sequence = 0,
  ready = false;
const opened = new Map();
function status(s) {
  $("status").textContent = s;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function send() {
  if (!ready || inflight) return;
  inflight = { id: ++sequence, text };
  vscode.postMessage({ type: "edit", id: inflight.id, version, text });
}
function commit(next, message = "") {
  next = syncLinks(pin(next), activeConfig, text);
  if (next === text) return;
  text = next;
  render();
  status(message);
  send();
}
window.addEventListener("message", ({ data: m }) => {
  if (m.type !== "update") return;
  if (inflight && m.ack !== inflight.id && !m.conflict) return;
  const queued = inflight && text !== inflight.text;
  version = m.version;
  activeConfig = m.config;
  ready = true;
  if (m.conflict) {
    vscode.postMessage({ type: "recover", text });
    inflight = null;
    text = m.text;
    status(
      "The document changed elsewhere. Your form draft is available with Recover Conflicting Draft.",
    );
    render();
    return;
  }
  if (m.ack) {
    inflight = null;
    if (queued) {
      send();
      return;
    }
  }
  text = m.text;
  render();
  if (m.notice) status(m.notice);
});
function errorMarkup(id, messages) {
  return `<span id="${id}" class="field-error" ${messages.length ? "" : "hidden"}>${messages.map(esc).join("<br>")}</span>`;
}
function render() {
  const focus = document.activeElement,
    key = focus?.dataset?.key,
    start = focus?.selectionStart,
    end = focus?.selectionEnd,
    scroll = $("releases").scrollTop;
  document
    .querySelectorAll(".release")
    .forEach((d) => opened.set(Number(d.dataset.r), d.open));
  model = parse(text);
  validation = validate(model.releases);
  const invalidCount = validation.filter(
    (x) => x.version.length || x.date.length,
  ).length;
  $("validation-summary").textContent = invalidCount
    ? `${invalidCount} release${invalidCount === 1 ? "" : "s"} need attention. Correct the red fields below.`
    : "SemVer and release dates are in order.";
  $("validation-summary").className = invalidCount ? "has-errors" : "valid";
  $("releases").innerHTML =
    model.releases
      .map((r, ri) => {
        const v = validation[ri],
          isU = unreleased(r.version);
        return `<details class="release" data-r="${ri}" ${(opened.get(ri) ?? (ri < 2 || !!v.version.length || !!v.date.length)) ? "open" : ""}><summary><span class="chevron">›</span><span class="version ${v.version.length ? "invalid-name" : ""}">${esc(r.version || "(empty version)")}</span>${isU ? '<span class="badge">UPCOMING</span>' : `<span class="summarydate ${v.date.length ? "invalid-name" : ""}">${esc(r.date || "No date")}</span>`}${r.yanked ? '<span class="badge yanked">YANKED</span>' : ""}${v.version.length || v.date.length ? '<span class="badge yanked">CHECK</span>' : ""}<span class="itemcount">${r.items.length} changes</span></summary><div class="releasebody"><div class="fields"><label class="field">Version<input class="${v.version.length ? "invalid-field" : ""}" data-key="${ri}-version" data-field="version" ${isU ? 'readonly aria-readonly="true" title="Unreleased is a permanent section"' : ""} value="${esc(r.version)}" placeholder="1.3.0 or Unreleased" aria-label="Release ${ri + 1} version" aria-invalid="${!!v.version.length}" aria-describedby="version-error-${ri}" autocomplete="off">${errorMarkup("version-error-" + ri, v.version)}</label>${isU ? errorMarkup("date-error-" + ri, v.date) : `<label class="field">Release date<input class="${v.date.length ? "invalid-field" : ""}" data-key="${ri}-date" data-field="date" type="date" value="${validDate(r.date) ? r.date : ""}" min="${v.min}" max="${v.max}" aria-invalid="${!!v.date.length}" aria-describedby="date-error-${ri}">${errorMarkup("date-error-" + ri, v.date)}</label>`}</div><div class="releaseopts">${isU ? '<span class="protected-label">Permanent section</span><button class="accent" data-action="create-release">Create release</button>' : `<label class="check"><input data-key="${ri}-yanked" data-field="yanked" type="checkbox" ${r.yanked ? "checked" : ""}>YANKED release</label><button class="remove" data-action="delete-release">Remove release</button>`}</div><div class="itemshead"><span>Changes <span class="pill">${r.items.length}</span></span></div>${r.items.map((item, ii) => `<div class="item" data-i="${ii}"><div class="itemtop"><select data-key="${ri}-${ii}-type" data-field="type" aria-label="Change ${ii + 1} type">${TYPES.map((t) => `<option ${t === item.type ? "selected" : ""}>${t}</option>`).join("")}</select><label class="check"><input data-key="${ri}-${ii}-breaking" data-field="breaking" type="checkbox" ${item.breaking ? "checked" : ""}>Breaking change</label><button data-action="delete-item" class="remove" aria-label="Remove change ${ii + 1}" title="Remove change">×</button></div>${item.type === "Security" ? `<label class="field cve-field">CVE ID <span class="optional">optional</span><input data-key="${ri}-${ii}-cve" data-field="cve" value="${esc(item.cve || "")}" placeholder="CVE-2026-12345" aria-label="Change ${ii + 1} CVE ID" aria-describedby="cve-error-${ri}-${ii}" autocomplete="off" spellcheck="false"><span id="cve-error-${ri}-${ii}" class="field-error" hidden></span></label>` : ""}<textarea class="itemtext" data-key="${ri}-${ii}-text" data-field="text" aria-label="Change ${ii + 1} description" rows="2">${esc(item.text)}</textarea></div>`).join("")}${r.items.length ? "" : '<div class="empty">No changes yet. Add the first one below.</div>'}<button class="additem" data-action="add-item">+ Add change</button>${r.sections.some((s) => !TYPES.includes(s.name)) ? '<p class="note">Custom sections are preserved. Edit them in Markdown.</p>' : ""}</div></details>`;
      })
      .join("") ||
    '<div class="empty">Paste or import a changelog, or add your first release.<br><br>Release headings use <code>## [1.0.0] - YYYY-MM-DD</code>.</div>';
  $("releases").scrollTop = scroll;
  $("count").textContent = model.releases.length;
  if (key) {
    const el = Array.from(document.querySelectorAll("[data-key]")).find(
      (el) => el.dataset.key === key,
    );
    if (el) {
      el.focus({ preventScroll: true });
      if (start != null && typeof el.setSelectionRange === "function")
        try {
          el.setSelectionRange(start, end);
        } catch {}
    }
  }
}
function fieldError(el, id, message) {
  el.classList.add("invalid-field");
  el.setAttribute("aria-invalid", "true");
  const msg = $(id);
  msg.hidden = false;
  msg.textContent = message;
  status("Correct the highlighted field");
}
function updateRelease(ri, field, value) {
  const r = model.releases[ri];
  if (unreleased(r.version) && ["version", "date", "yanked"].includes(field))
    return;
  const updated = { ...r, [field]: value },
    edits = [];
  if (field === "version") {
    updated.bracket = true;
    if (unreleased(value)) updated.date = "";
    if (r.refkey.toLowerCase() === r.version.toLowerCase()) {
      updated.refkey = value;
      if (r.ref && !r.inline)
        edits.push({
          start: r.ref.start,
          end: r.ref.end,
          value: value ? `[${value}]: ${r.link}\n` : "",
        });
    }
  }
  edits.push({ start: r.start, end: r.headEnd, value: heading(updated) });
  commit(patches(text, edits));
  if (field === "version" && unreleased(value) && ri !== 0) {
    const input = $("releases").querySelector('[data-key="0-version"]');
    input?.focus();
    if (input) input.setSelectionRange(value.length, value.length);
  }
}
function mutateField(e) {
  const el = e.target,
    field = el.dataset.field;
  if (!field) return;
  const ri = Number(el.closest("[data-r]").dataset.r),
    r = model.releases[ri],
    value = el.type === "checkbox" ? el.checked : el.value;
  const node = el.closest("[data-i]");
  if (node) {
    const ii = Number(node.dataset.i),
      old = r.items[ii],
      item = { ...old, [field]: value };
    if (field === "cve") {
      item.cve = value.trim().toUpperCase();
      if (item.cve && !Changelog.CVE_ID.test(item.cve)) {
        fieldError(
          el,
          "cve-error-" + ri + "-" + ii,
          "Use CVE-YYYY-NNNN (at least four final digits). Invalid IDs are not written to Markdown.",
        );
        return;
      }
    }
    if (field === "type") {
      if (value !== "Security" && old.cve) {
        item.text = old.cve + ": " + old.text;
        item.cve = "";
      } else if (value === "Security") {
        const parsed = Changelog.parseItemContent(item.text, "Security");
        item.text = parsed.text;
        item.cve = parsed.cve;
        item.breaking = item.breaking || parsed.breaking;
      }
      commit(appendItem(removeItem(text, ri, ii), ri, item));
    } else commit(replace(text, old.start, old.end, itemMarkdown(item)));
    return;
  }
  if (field === "version" && /[\[\]\r\n]/.test(value)) {
    fieldError(
      el,
      "version-error-" + ri,
      "Use SemVer without brackets, e.g. 1.2.3, or Unreleased.",
    );
    return;
  }
  if (field === "date") {
    const v = validation[ri];
    if (
      !validDate(value) ||
      (v.min && value < v.min) ||
      (v.max && value > v.max)
    ) {
      fieldError(
        el,
        "date-error-" + ri,
        `Choose a valid date${v.min ? " on or after " + v.min : ""}${v.max ? " on or before " + v.max : ""}. The Markdown date has not changed.`,
      );
      return;
    }
  }
  updateRelease(ri, field, value);
}
$("releases").addEventListener("input", (e) => {
  if (["text", "version", "cve"].includes(e.target.dataset.field))
    mutateField(e);
});
$("releases").addEventListener("change", (e) => {
  if (!["text", "version", "cve"].includes(e.target.dataset.field))
    mutateField(e);
});
$("releases").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const ri = Number(btn.closest("[data-r]").dataset.r),
    r = model.releases[ri];
  if (btn.dataset.action === "create-release") {
    try {
      commit(
        Changelog.createRelease(text, today()),
        "Release created · Unreleased cleared · Undo is available",
      );
      focusNewRelease();
    } catch (err) {
      status(err.message);
    }
  }
  if (btn.dataset.action === "add-item") {
    commit(
      appendItem(text, ri, {
        type: "Added",
        text: "Describe the change.",
        breaking: false,
      }),
    );
    const nodes = $("releases").querySelectorAll(`[data-r="${ri}"] .itemtext`);
    nodes[nodes.length - 1]?.focus();
    nodes[nodes.length - 1]?.select();
  }
  if (btn.dataset.action === "delete-item")
    commit(
      removeItem(text, ri, Number(btn.closest("[data-i]").dataset.i)),
      "Change removed · Undo is available",
    );
  if (btn.dataset.action === "delete-release") {
    if (unreleased(r.version)) return;
    const dialog = $("confirm");
    dialog.showModal();
    dialog.addEventListener(
      "close",
      () => {
        if (dialog.returnValue === "remove") {
          const edits = [{ start: r.start, end: r.end, value: "" }];
          if (
            r.ref &&
            (r.ref.start < r.start || r.ref.start >= r.end) &&
            model.releases.filter((x) => x.ref?.start === r.ref.start)
              .length === 1
          )
            edits.push({ start: r.ref.start, end: r.ref.end, value: "" });
          commit(patches(text, edits), "Release removed · Undo is available");
        }
      },
      { once: true },
    );
  }
});
function focusNewRelease() {
  const index = model.releases.findIndex((r) => !unreleased(r.version));
  const detail = $("releases").querySelector(`[data-r="${index}"]`);
  if (detail) {
    detail.open = true;
    detail.querySelector("input").focus();
    detail.querySelector("input").select();
  }
}
$("add").onclick = () => {
  commit(nextRelease(text, today()), "Release added");
  focusNewRelease();
};
vscode.postMessage({ type: "ready" });
