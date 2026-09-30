# Architecture

`media/engine.js` parses source ranges and edits Markdown while preserving surrounding content. `media/rules.js` handles SemVer, dates, repository links and release lifecycle. They run both in Node tests and in the webview.

`media/app.js` contains the form renderer and versioned message bridge. `media/body.html` and `media/style.css` provide the single-panel shell, Keep a Changelog-inspired palette, mark, background and bundled fonts.

`src/extension.js` registers the CustomTextEditorProvider and commands. It talks to VS Code's built-in Git extension instead of assuming `.git` is a directory. `src/model.js` holds pure document-diff and configuration helpers.

The extension has no bundler or runtime npm dependencies. Packaging includes source JavaScript; the source archive additionally contains tests, CI workflows, documentation and development configuration.
