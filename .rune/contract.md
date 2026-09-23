# CodePilot2 Rune Contract

## Mission

Keep CodePilot2 working as a GitHub-centered AI project builder while preventing regressions caused by unnecessary rewrites.

## Hard invariants

- GitHub Pages remains a static frontend.
- No secret is shipped to browser JavaScript.
- GitHub Actions remains the trusted execution boundary for generation and publishing.
- Existing providers must not disappear: Gemini, DeepSeek, OpenAI, OpenRouter.
- Existing project-loading, code-editor, copy, download, and preview capabilities must not be removed as a side effect of another fix.
- Preview must use the currently edited in-memory files.
- GitHub repository URL parsing and HTTP/network errors must remain distinguishable.
- Unsafe repository paths and traversal sequences must be rejected.
- Generated and published files must remain inside the requested repository/path boundary.
- Changes must be incremental and independently verifiable.

## Stop conditions

Stop and investigate instead of adding more code when main JavaScript has a syntax error, a working UI control disappears, preview becomes blank after an unrelated change, a GitHub error is collapsed to generic invalid URL, or a secret would need to be exposed.

## Evidence rule

Never mark a task TESTED or PROVEN from a successful commit alone. Evidence must come from an actual validation command, workflow result, or reproducible runtime check.
