# Commands and behavior

| Command | Behavior |
| --- | --- |
| Changelog Studio: Open Release Editor | Opens the selected or active Markdown file beside the text editor; prompts for a file when needed. |
| Changelog Studio: New Changelog | Chooses a destination, reads Git settings, asks for tag prefix and ref, and creates the minimal sample. Never overwrites an existing file. |
| Changelog Studio: Recover Conflicting Draft | Opens the most recent conflicting form draft as an unsaved Markdown document. |
| Reopen Editor With → Changelog Studio | Uses the form as the current editor for a `.md` file. |

The form includes Add release, Create release, release removal, change items, SemVer/date fields, numbered-release YANKED checkboxes, breaking changes and optional Security CVE IDs. Unreleased has a read-only name, no calendar, no YANKED control, and no remove button.

Save, Save As, Undo, Redo, source editing and file navigation belong to VS Code. There are no import/export/reset buttons or a second Markdown editor embedded in the form. The extension is optional for Markdown files and does not replace their default editor.

Requires VS Code 1.96+ on desktop or a remote extension host. This is a Node extension, not a browser-only vscode.dev extension. No workspace executable is invoked. Restricted/virtual workspaces can edit documents supported by their filesystem provider; Git discovery depends on the built-in Git extension being available.
