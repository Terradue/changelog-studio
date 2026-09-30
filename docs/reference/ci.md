# CI contract

The workflows are adapted from [eoap/schema-salad-studio](https://github.com/eoap/schema-salad-studio/tree/main/.github/workflows), retaining its jobs and command contract. Artifact names use `changelog-studio`.

| Workflow | Triggers | Commands / output |
| --- | --- | --- |
| `ci.yml` | All branch pushes, PRs, manual | Node 22, Python 3.12, `npm ci`, `npm run check`, Chromium installation, `npm run test:ui`, `npm run package`, upload `dist/*.vsix`. |
| `docs.yaml` | Relevant docs changes on main/develop and PRs, manual | Install `requirements-docs.txt`; strict build using `mkdocs.yaml`; main pushes deploy `gh-pages`. |
| `release.yml` | `v*.*.*` tag pushes | Validate `vX.Y.Z` against manifest, check/test/package, upload VSIX to GitHub release. |

`contents: read` is the default. Only documentation deployment and release publication get `contents: write`. The release workflow uses `github.token`; no Marketplace secret is required. npm caching depends on the committed lockfile.
