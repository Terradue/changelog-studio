# Synchronization and safety

The VS Code TextDocument is authoritative. A CustomTextEditorProvider presents the release form, and applies form changes with WorkspaceEdit. Save, dirty state, hot-exit persistence, native undo/redo and external file changes remain VS Code responsibilities.

The webview optimistically renders edits, sends one document replacement at a time with the version it observed, and queues further typing until acknowledgment. The host reduces the replacement to the smallest common-prefix/common-suffix edit. Updates from the text editor refresh the form. A stale version is rejected and its form draft is preserved for recovery, rather than merged by guessing. Only the most recent conflicting draft is retained in VS Code workspace state.

CRLF documents keep CRLF line endings. Opening a changelog does not rewrite it. Form mutations pin Unreleased and regenerate managed links when enough valid repository information exists. Source edits are shown as entered, including validation errors; normalization happens on the next form mutation.

Document text is escaped before insertion into the webview. A restrictive content security policy allows only bundled styles/fonts/images and nonce-authorized scripts. No document HTML executes, no server is contacted, and no repository script is run.
