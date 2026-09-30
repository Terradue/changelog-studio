# Package and release

Run `npm ci`, the checks and UI tests, then `npm run package`. Install the resulting `dist/changelog-studio-0.1.0.vsix` through **Extensions: Install from VSIX…**.

Before public publication:

1. Choose your actual GitHub repository and update package metadata (`repository`, `bugs`, `homepage`). Set `publisher` to your own Marketplace publisher ID if publishing there.
2. Review the MIT license and third-party notices.
3. Increment `package.json` version and refresh `package-lock.json` with `npm install --package-lock-only`.
4. Commit and push a matching tag, such as `v0.1.0`.

The release workflow verifies exact tag/version agreement, runs checks and browser tests, packages the VSIX, then attaches it to a GitHub release using the workflow token. It does not publish to the VS Code Marketplace. Existing release assets with the same filename are replaced on reruns.

The docs workflow builds on relevant pull requests and pushes; pushes to `main` deploy documentation to `gh-pages`. To expose it on GitHub Pages, configure the repository to serve that branch. No workflow has been run or deployed as part of generating this source archive.
