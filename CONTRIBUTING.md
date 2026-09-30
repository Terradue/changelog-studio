# Contributing

Use Node 22+ and `npm ci`. Run `npm run check`, install Chromium with `npx playwright install --with-deps chromium`, then run `npm run test:ui` and `npm run package`. Build documentation with `python -m mkdocs build --strict -f mkdocs.yaml`.

Keep the Markdown engine independent of VS Code. Add regression coverage for parsing and synchronization changes. Update the relevant Diátaxis documentation page. Never log document contents, add telemetry, or execute workspace scripts while reading repository settings.

For manual integration verification, press F5 and open a fixture in text and form views. Test native Undo/Redo, Save/Revert, two split form views, a CRLF file, a nested Git repository, and external text edits. Browser tests exercise the real form with a simulated host; they do not replace this Extension Host smoke test.
