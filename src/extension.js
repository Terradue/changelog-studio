"use strict";
const vscode = require("vscode");
const crypto = require("node:crypto");
const {
  C,
  minimalEdit,
  sample,
  gitRepository,
  remoteUrl,
  settingsFrom,
} = require("./model");
const VIEW = "changelogStudio.editor";
function activate(context) {
  const seeds = new Map();
  let recovery = "";
  const guard =
    (fn) =>
    async (...args) => {
      try {
        return await fn(...args);
      } catch (e) {
        vscode.window.showErrorMessage(`Changelog Studio: ${e.message}`);
      }
    };
  async function git(uri) {
    const ext = vscode.extensions.getExtension("vscode.git");
    if (!ext) return null;
    const api = (ext.isActive ? ext.exports : await ext.activate()).getAPI(1);
    if (api.state === "uninitialized") {
      await new Promise(resolve => {
        const subscription = api.onDidChangeState(state => {
          if (state === "initialized") { subscription.dispose(); resolve(); }
        });
        if (api.state === "initialized") { subscription.dispose(); resolve(); }
      });
    }
    return gitRepository(api.repositories, uri);
  }
  async function repoSettings(uri, creating, text = "") {
    const repo = await git(uri),
      remote = remoteUrl(repo),
      parsed = C.inferSettings(text);
    let config = parsed.complete ? parsed.settings : null;
    if (!creating) {
      if (config) return settingsFrom(text, remote, config);
      if (repo) return null;
      // Only ask for a URL outside Git; never ask for tag/ref while opening a file.
      if (!parsed.settings?.head) return null;
    }
    let url = remote || config?.url;
    if (!url && !repo) {
      url = await vscode.window.showInputBox({
        title: "Repository URL",
        prompt: "Repository used for release comparisons (optional)",
        ignoreFocusOut: true,
        validateInput: (v) =>
          !v
            ? ""
            : C.repository(v, "github").error && C.repository(v, "gitlab").error
              ? "Enter a valid GitHub or GitLab repository URL"
              : undefined,
      });
      if (url === undefined) return undefined;
    }
    let detected = url ? C.repository(url) : null;
    if (detected?.error && url) {
      const host = await vscode.window.showQuickPick(["GitHub", "GitLab"], {
        title: "Repository host",
      });
      if (!host) return undefined;
      detected = C.repository(url, host.toLowerCase());
    }
    if (creating) {
      const prefix = await vscode.window.showInputBox({
        title: "Tag prefix",
        value: "v",
        prompt: "Leave empty for tags such as 0.1.0",
        ignoreFocusOut: true,
        validateInput: (v) =>
          /[\s<>\[\]\\]/.test(v)
            ? "Use a Git tag prefix without spaces or brackets"
            : undefined,
      });
      if (prefix === undefined) return undefined;
      const head = await vscode.window.showInputBox({
        title: "Unreleased ref",
        value: "HEAD",
        prompt: "Branch or ref compared with the latest release",
        ignoreFocusOut: true,
        validateInput: (v) =>
          C.configError({
            url: "https://github.com/o/r",
            provider: "github",
            prefix,
            head: v,
          }) || undefined,
      });
      if (head === undefined) return undefined;
      if (detected && !detected.error)
        return {
          url: detected.base,
          provider: detected.provider,
          prefix,
          head,
        };
      return null;
    }
    return detected && !detected.error
      ? { ...parsed.settings, url: detected.base, provider: detected.provider }
      : null;
  }
  const provider = {
    async resolveCustomTextEditor(document, panel) {
      const key = document.uri.toString();
      let config =
        seeds.get(key) ||
        (await repoSettings(document.uri, false, document.getText()));
      const repo = await git(document.uri);
      const remote = remoteUrl(repo);
      let disposed = false;
      let queue = Promise.resolve();
      const webview = panel.webview;
      webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      };
      const update = (extra = {}) => {
        config = settingsFrom(document.getText(), remote, config);
        if (!disposed)
          webview.postMessage({
            type: "update",
            text: document.getText(),
            version: document.version,
            config,
            ...extra,
          });
      };
      const changed = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === key) update();
      });
      const received = webview.onDidReceiveMessage((m) => {
        queue = queue
          .then(async () => {
            if (disposed || !m || typeof m !== "object") return;
            if (m.type === "ready") {
              update({
                notice: config
                  ? ""
                  : "Comparison links are preserved. To enable generation, add a supported Unreleased compare link in Markdown.",
              });
              return;
            }
            if (m.type === "recover" && typeof m.text === "string") {
              recovery = m.text;
              await context.workspaceState.update("conflictingDraft", recovery);
              return;
            }
            if (
              m.type !== "edit" ||
              typeof m.text !== "string" ||
              !Number.isSafeInteger(m.version) ||
              !Number.isSafeInteger(m.id)
            )
              return;
            if (m.version !== document.version) {
              update({ conflict: true, ack: m.id });
              return;
            }
            const before = document.getText();
            const normalized =
              document.eol === vscode.EndOfLine.CRLF
                ? m.text.replace(/\r?\n/g, "\r\n")
                : m.text;
            if (before !== normalized) {
              const d = minimalEdit(before, normalized),
                edit = new vscode.WorkspaceEdit();
              edit.replace(
                document.uri,
                new vscode.Range(
                  document.positionAt(d.start),
                  document.positionAt(d.end),
                ),
                d.text,
              );
              const ok = await vscode.workspace.applyEdit(edit);
              if (!ok) {
                update({ conflict: true, ack: m.id });
                return;
              }
            }
            update({ ack: m.id });
          })
          .catch((e) => {
            update({ conflict: true });
            vscode.window.showErrorMessage(`Changelog Studio: ${e.message}`);
          });
      });
      panel.onDidDispose(() => {
        disposed = true;
        changed.dispose();
        received.dispose();
      });
      const nonce = crypto.randomBytes(24).toString("base64"),
        asset = (name) =>
          webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "media", name),
          );
      const body = Buffer.from(
        await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(context.extensionUri, "media", "body.html"),
        ),
      ).toString("utf8");
      webview.html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${asset("style.css")}"><title>Changelog Studio</title></head><body>${body}${["engine.js", "rules.js", "app.js"].map((n) => `<script nonce="${nonce}" src="${asset(n)}"></script>`).join("")}</body></html>`;
    },
  };
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "changelogStudio.open",
      guard(async (uri) => {
        uri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!uri) {
          const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { Markdown: ["md"] },
          });
          uri = files?.[0];
        }
        if (uri)
          await vscode.commands.executeCommand("vscode.openWith", uri, VIEW, {
            viewColumn: vscode.ViewColumn.Beside,
          });
      }),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "changelogStudio.new",
      guard(async () => {
        const folders = vscode.workspace.workspaceFolders;
        const folder =
          folders?.length > 1
            ? await vscode.window.showWorkspaceFolderPick()
            : folders?.[0];
        const uri = await vscode.window.showSaveDialog({
          defaultUri: folder
            ? vscode.Uri.joinPath(folder.uri, "CHANGELOG.md")
            : undefined,
          filters: { Markdown: ["md"] },
          title: "Create CHANGELOG.md",
        });
        if (!uri) return;
        try {
          await vscode.workspace.fs.stat(uri);
          vscode.window.showWarningMessage(
            "This file already exists. Use Open Release Editor to edit it.",
          );
          return;
        } catch (e) {
          if (e.code !== "FileNotFound") throw e;
        }
        const config = await repoSettings(uri, true);
        if (config === undefined) return;
        const d = new Date(),
          date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { overwrite: false });
        edit.insert(uri, new vscode.Position(0, 0), sample(config, date));
        if (!(await vscode.workspace.applyEdit(edit))) return;
        seeds.set(uri.toString(), config);
        await vscode.commands.executeCommand("vscode.openWith", uri, VIEW);
      }),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "changelogStudio.recover",
      guard(async () => {
        const text = recovery || context.workspaceState.get("conflictingDraft");
        if (!text) {
          vscode.window.showInformationMessage(
            "No conflicting draft to recover.",
          );
          return;
        }
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({
            language: "markdown",
            content: text,
          }),
        );
      }),
    ),
  );
}
module.exports = { activate };
