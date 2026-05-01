---
description: AI-agnostic commit planning protocol for any assistant
---

# AI Commit Planning Protocol

## Purpose
Standardized workflow for analyzing git changes and creating proper commit sequences.

## Pre-execution
Analyze: `git status`, `git diff --stat`, `git diff [files]`.
Inspect: Read new files fully, diffs for modified, and cross-file dependencies.

## Categorization & Order (Priority)
Commit in this order:
1. **Foundation** (`chore`): Config, tooling, types.
2. **Libraries** (`feat`/`refactor`): Shared utilities, clients.
3. **Services** (`feat`/`refactor`): Business logic, API handlers.
4. **Presentation** (`feat`/`refactor`): UI components, styling.
5. **Tests** (`test`): Unit/integration tests.
6. **Docs** (`docs`): README, examples.

**Dependency Rule:** Commit dependencies/types before consumers. Commit code before tests.

## Commit Standard
Format: `<type>: <description>` (Imperative mood, no trailing period, <50 chars).
Describe **WHAT** and **WHY**, not HOW.

| Type | Use Case |
|------|----------|
| `feat` | New feature/enhancement |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding/updating tests |
| `docs` | Documentation/examples |
| `chore` | Config, deps, tooling |

## Execution Flow
1. **Plan**: Map changes to commits based on priority/dependencies.
2. **Output**:
   | Order | Commit | Files | Deps |
   |-------|--------|-------|------|
   | 1 | `type: desc` | `file.ts` | None |
3. **Execute**: `git add <files> && git commit -m "<msg>"`
4. **Verify**: Run tests/linter $\rightarrow$ check `git status`.

## Anti-patterns
- No tests before code.
- No consumers before dependencies.
- No unrelated changes in one commit.
- No vague messages (e.g., "update files").

## Example
- `eslint.config.mjs` $\rightarrow$ `chore: add fetch globals to eslint config`
- `http-client.ts` $\rightarrow$ `feat: implement HTTP client`
- `http-client.test.ts` $\rightarrow$ `test: add unit tests for HTTP client`
