# Develop and test

Install Node.js 22+, run `npm ci`, and press F5 in VS Code. The debug configuration launches this folder in an Extension Development Host.

```sh
npm run check
npx playwright install --with-deps chromium
npm run test:ui
npm run package
```

`check` syntax-checks source and runs Node tests. Browser tests exercise the actual release renderer with a simulated VS Code message bridge. They cover protected Unreleased, CVE and breaking markers, release creation, date bounds, validation, deletion, external updates, and conflict recovery. Host tests use a VS Code API mock; manually verify native editor integration in the Extension Development Host before release.

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict -f mkdocs.yaml
```

Keep `package-lock.json` committed. Runtime code has no npm dependencies; dev dependencies supply packaging and tests.
