# Changelog Studio

A VS Code visual editor for Keep a Changelog Markdown. Edit releases in a form alongside the original file, with native save, undo, and redo.

## Install and use

1. Install `changelog-studio-0.1.0.vsix` using **Extensions: Install from VSIX…**.
2. Open a changelog and run **Changelog Studio: Open Release Editor**. The form opens beside the text.
3. Or run **Changelog Studio: New Changelog** to create a minimal sample.
4. Save with VS Code as usual. Form changes mark the document dirty; your normal Auto Save policy applies.

You can also use **Reopen Editor With… → Changelog Studio** on a Markdown file.

## Features

- Add, edit and remove releases and change items; six standard change types.
- SemVer ordering, calendar date bounds, inline errors, YANKED numbered releases.
- Protected Unreleased, with **Create release** moving all content into a new numbered release.
- Breaking change checkbox and optional Security CVE IDs.
- Automatic descending comparison links for GitHub and GitLab, including supported self-hosted URLs.
- Git remote detection; existing Unreleased links provide tag prefix and development ref.
- No server, network requests, telemetry, or runtime dependencies. Fonts and styling are bundled.

## Develop

Requires Node.js 22 or later and VS Code 1.96 or later.

```sh
npm ci
npm run check
npx playwright install --with-deps chromium
npm run test:ui
npm run package
```

Press F5 in VS Code to launch the Extension Development Host. Packages are written to `dist/`.

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs serve -f mkdocs.yaml
```

Documentation uses Diátaxis: tutorial (`docs/tutorials/first-release.md`), how-to guides (`docs/how-to/git.md`), reference (`docs/reference/commands.md`), and explanation (`docs/explanation/synchronization.md`).

## Publishing your fork

The manifest's `publisher` is a local packaging placeholder. Before Marketplace publication, set it to your registered publisher ID and add your actual GitHub `repository`, `bugs` and `homepage` URLs. Local VSIX installation and the included CI do not require Marketplace credentials. See releasing (`docs/how-to/release.md`).

Apache-2.0 licensed. Bundled upstream assets retain their own notices; see NOTICE (`NOTICE`). This is an independent project, not an official Keep a Changelog extension.
