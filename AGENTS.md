# CodePilot2 Governance - Rune

This repository uses Rune (@rune-kit/rune) as its engineering-governance layer.

## Non-negotiable rules

1. Do not replace working architecture with a new stack unless the current architecture is proven incapable.
2. Make the smallest change that fixes the reported defect.
3. Preserve working UI, editor, preview, GitHub integration, and generation paths unless the task explicitly changes them.
4. One issue at a time: inspect -> change -> verify -> commit.
5. Never claim a feature is fixed without evidence from a real check.
6. Never put GitHub tokens, AI API keys, or other secrets in browser-delivered JavaScript.
7. GitHub is the source of truth for project code and workflows.
8. Keep GitHub Pages static; trusted generation and publishing stays in GitHub Actions.
9. For preview changes, verify editor runtime and preview runtime before touching unrelated code.
10. For GitHub URL errors, distinguish parsing errors, HTTP 404/403, network failures, and repository permissions.

## Required change loop

Read current files -> identify exact failure -> make surgical patch -> run narrow validation -> run governance checks -> commit.

## Current priority

Stability comes before feature expansion. Governance must sit around the existing working project, not replace it.
