# Use Git and existing changelogs

Open any existing Markdown changelog, then run **Changelog Studio: Open Release Editor**. The extension reads the current unsaved document as well as later changes.

## Repository selection

The extension reads VS Code's built-in Git extension API. That API handles `.git` directories, worktree `.git` files, nested repositories, and multi-root workspaces. The deepest repository containing the document wins. Remote preference is the current branch's upstream remote, then `origin`, then the first configured remote. Fetch URL is preferred to push URL. SSH GitHub/GitLab remotes are normalized to HTTPS comparison URLs.

For existing files, the Unreleased comparison link supplies the tag prefix and ref. A supported Git remote supplies the repository URL. Outside Git, a complete existing link already supplies all settings. The extension asks for a repository URL only when it needs one outside Git; it never asks for tag prefix or Unreleased ref while opening an existing document.

Git repositories without a remote do not trigger a URL prompt. Existing links remain usable; otherwise generation stays off. If Git is disabled or unavailable, repository discovery is unavailable.

## Missing or unsupported links

No branch or tag prefix is guessed for an existing document. Add a supported reference in Markdown, for example:

```markdown
[Unreleased]: https://github.com/owner/project/compare/v0.1.0...main
```

Or for GitLab:

```markdown
[Unreleased]: https://gitlab.example.org/team/project/-/compare/v0.1.0...develop
```

The form detects it on the next document update. Unsupported hosts keep their URLs without automatic generation. Conflicting links and malformed versions are preserved for correction. For new self-hosted repositories, a host picker distinguishes GitHub from GitLab.

## Recover a concurrent edit

If the source changes while a form edit is in flight, run **Changelog Studio: Recover Conflicting Draft**. It opens the latest conflicting form draft in an unsaved Markdown document. Compare and copy the intended changes into the original; the extension does not overwrite newer source automatically.
