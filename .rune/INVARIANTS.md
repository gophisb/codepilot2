# CodePilot2 Invariants

I-001 Stable architecture: do not rewrite when a surgical fix is sufficient.
I-002 Browser safety: browser code must never contain GitHub PATs or AI provider secrets.
I-003 GitHub boundary: secret-requiring generation and publishing execute inside GitHub Actions.
I-004 Editor integrity: editing one file must not destroy other in-memory files.
I-005 Preview integrity: preview consumes current edited project state and cannot disable the editor.
I-006 URL diagnostics: parsing, HTTP 404/403, network, and permission failures are separate.
I-007 Path safety: reject traversal and protected paths unless explicitly required.
I-008 Minimal change: every repair touches the smallest necessary surface.
I-009 Verification: no fixed claim without evidence.
I-010 Source of truth: the GitHub repository is authoritative.

I-011 Standalone index isolation: uploading/editing index.html alone must not mutate generatedFiles or the existing project editor state.
I-012 Standalone preview safety: index.html preview stays sandboxed and has no access to GitHub/AI secrets.
