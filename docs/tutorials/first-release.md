# Your first release

Install the VSIX using **Extensions: Install from VSIX…**, then open a project folder.

1. Run **Changelog Studio: New Changelog** and choose `CHANGELOG.md`.
2. If the folder is not in Git, supply a repository URL or leave it empty. Git projects use their remote automatically.
3. Set **Tag prefix** to `v` and **Unreleased ref** to `HEAD`, or use your repository's conventions.
4. The sample has an empty Unreleased section and `0.1.0` with one Added item, “Initial release”.
5. In Unreleased, select **Add change**, choose **Security**, and enter a description. Optionally enter `CVE-2026-12345`.
6. Select **Create release**. The changes move to `0.1.1`; Unreleased remains empty and protected. Edit the suggested version if you intend a minor or major release.
7. Open the file as text beside the form. Change the description in Markdown and observe the form update.
8. Save through VS Code. Try Undo and Redo to see both views follow the document.

Creating a release only edits Markdown. It does not create Git tags, commits, or remote releases.
