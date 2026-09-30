const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs");
const model = require("../src/model");
test("custom editor uses native edits, broadcasts updates, rejects stale writes and disposes", async () => {
  let provider,
    listener,
    onMessage,
    onDispose,
    text = model.sample(null, "2026-09-30"),
    version = 1;
  const messages = [],
    commands = new Map();
  let disposed = 0,
    applied = 0;
  const uri = {
    toString: () => "file:///project/CHANGELOG.md",
    scheme: "file",
    authority: "",
    path: "/project/CHANGELOG.md",
  };
  const document = {
    uri,
    get version() {
      return version;
    },
    getText: () => text,
    eol: 1,
    positionAt: (n) => n,
  };
  class Edit {
    replace(uri, range, value) {
      this.range = range;
      this.value = value;
    }
  }
  const api = {
    EndOfLine: { CRLF: 2 },
    Range: class {
      constructor(start, end) {
        this.start = start;
        this.end = end;
      }
    },
    WorkspaceEdit: Edit,
    Uri: { joinPath: (_, path) => path },
    extensions: { getExtension: () => null },
    window: {
      registerCustomEditorProvider: (_, p) => {
        provider = p;
        return {};
      },
      showErrorMessage: (e) => {
        throw Error(e);
      },
      showInformationMessage: () => {},
    },
    commands: {
      registerCommand: (name, fn) => {
        commands.set(name, fn);
        return {};
      },
    },
    workspace: {
      onDidChangeTextDocument: (fn) => {
        listener = fn;
        return {
          dispose() {
            disposed++;
          },
        };
      },
      fs: { readFile: async () => Buffer.from("<main></main>") },
      applyEdit: async (edit) => {
        applied++;
        text =
          text.slice(0, edit.range.start) +
          edit.value +
          text.slice(edit.range.end);
        version++;
        listener({ document });
        return true;
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/extension"), "utf8"),
    {
      require: (n) =>
        n === "vscode" ? api : n === "./model" ? model : require(n),
      module,
      Buffer,
    },
  );
  module.exports.activate({
    subscriptions: [],
    extensionUri: {},
    workspaceState: { update: async () => {}, get: () => null },
  });
  await provider.resolveCustomTextEditor(document, {
    webview: {
      cspSource: "test:",
      asWebviewUri: (x) => x,
      postMessage: (m) => messages.push(m),
      onDidReceiveMessage: (fn) => {
        onMessage = fn;
        return {
          dispose() {
            disposed++;
          },
        };
      },
    },
    onDidDispose: (fn) => (onDispose = fn),
  });
  const tick = () => new Promise((r) => setImmediate(r));
  onMessage({ type: "ready" });
  await tick();
  assert.equal(messages.at(-1).version, 1);
  onMessage({
    type: "edit",
    id: 1,
    version: 1,
    text: text.replace("Initial release", "Updated"),
  });
  await tick();
  assert.equal(applied, 1);
  assert.equal(messages.at(-1).ack, 1);
  assert(text.includes("Updated"));
  onMessage({ type: "edit", id: 2, version: 1, text: "stale" });
  await tick();
  assert.equal(applied, 1);
  assert(messages.at(-1).conflict);
  text = text.replace("Updated", "Native undo");
  version++;
  listener({ document });
  assert(messages.at(-1).text.includes("Native undo"));
  onDispose();
  assert.equal(disposed, 2);
  assert(commands.has("changelogStudio.new"));
});
