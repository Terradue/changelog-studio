# Markdown and validation

Release headings use `## [1.2.3] - YYYY-MM-DD`; Unreleased uses `## [Unreleased]`. The six change types are Added, Changed, Deprecated, Removed, Fixed, and Security.

Numbered release names must follow SemVer 2.0.0 and descend strictly in precedence. Build metadata does not alter precedence. New releases suggest the next patch version (or the stable version of the latest prerelease). Dates descend and may be equal; calendars enforce bounds from older and newer releases. Imported mistakes remain visible as red field errors until corrected.

Breaking items use `**Breaking:**`. Security CVE IDs use `CVE-YYYY-NNNN` with at least four final digits, rendered as `- CVE-2026-12345: **Breaking:** Description`. CVE IDs are optional. YANKED appears as `[YANKED]` on numbered headings.

Create release moves the full Unreleased body, including custom sections and prose, into the new release. Unreleased stays empty. Custom sections remain editable in Markdown. This parser recognizes conventional Keep a Changelog headings and list items; it is not a general Markdown AST editor.

Automatic link generation rebuilds managed release references after each form mutation, in descending order. The oldest release links to its tag. Invalid versions pause generation. Unrelated Markdown and reference definitions are preserved. Manually entered invalid Unreleased dates or YANKED markers must be removed in source.
