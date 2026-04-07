# Built-in Rules

Agent Runway ships with five built-in convention rules and support for custom regex-based rules. All rules default to `enabled: true` with `warn` enforcement.

## no_inline_comments

**What it catches:** Standalone comments and inline comments in code files.

**Supported comment styles:**

| Style | Languages |
|-------|-----------|
| `#` comments | Python, Ruby, Shell |
| `//` comments | JavaScript, TypeScript, Go, Rust, Java, C, C++, Swift, Kotlin, Scala, C# |

**Examples flagged:**

```python
# This is a standalone comment                    <- FLAGGED
x = 1  # this is an inline comment                <- FLAGGED
```

```typescript
// This is a standalone comment                   <- FLAGGED
const x = 1; // this is an inline comment         <- FLAGGED
```

**Examples allowed:**

```python
#!/usr/bin/env python3                             <- shebang, allowed
# -*- coding: utf-8 -*-                            <- encoding declaration, allowed
x: int  # type: int                                <- type hint comment (Python 2 style), allowed
# pragma: no cover                                 <- pragma directive, allowed
```

**How it works:**

The rule scans each line and checks for `#` or `//` comment markers depending on the file type. For `#`-style comments, it applies these exclusion filters in order:

1. Shebangs (`#!/`)
2. Encoding declarations (`# coding:` or `# coding=`)
3. Type hint comments (`# type:` followed by anything other than `ignore`)
4. Pragma directives (`# pragma`)
5. Lines that are themselves `# noqa` or `# type: ignore` (caught by their own rules)

For `//`-style comments, it excludes:

1. Lines that are lint suppressions (caught by `no_lint_suppressions`)
2. Triple-slash directives (`///` references in TypeScript, doc comments in Rust/C#)

Everything else with a comment marker preceded by whitespace (inline) or at the start of the line (standalone) is flagged.

**When to use `block`:** When your project has a strict "code reads itself" policy and comments are never acceptable.

**When to use `warn`:** When you want to discourage comments but allow them in edge cases.

## no_lint_suppressions

**What it catches:** Lint suppression directives across all supported languages. This is a universal rule that replaces the need for custom rules targeting language-specific suppressions.

**Supported languages and patterns:**

| Language | Suppression Patterns |
|----------|---------------------|
| Python | `# noqa`, `# type: ignore`, `# pylint: disable`, `# pragma: no cover`, `# fmt: off`, `# fmt: skip`, `# isort: skip`, `# mypy: ignore` |
| JavaScript / TypeScript | `// @ts-ignore`, `// @ts-nocheck`, `// @ts-expect-error`, `// eslint-disable`, `// biome-ignore`, `// prettier-ignore`, `// @flow-ignore`, `// c8 ignore`, `// istanbul ignore`, `// v8 ignore` |
| Go | `// nolint`, `// nosec`, `// go:nosplit`, `// go:noinline`, `// go:noescape`, `// exhaustive:ignore` |
| Java | `@SuppressWarnings`, `// CHECKSTYLE: OFF`, `// NOSONAR`, `// NOPMD`, `// spotbugs:ignore` |
| Kotlin | `@Suppress`, `// ktlint-disable`, `@file:Suppress` |
| Scala | `// scalafix:off`, `// scalastyle:off`, `@SuppressWarnings` |
| C / C++ | `// NOLINT`, `// NOLINTNEXTLINE`, `#pragma warning(disable)`, `#pragma GCC diagnostic ignored`, `#pragma clang diagnostic ignored`, `// GCOVR_EXCL` |
| C# | `#pragma warning disable`, `// ReSharper disable`, `[SuppressMessage]` |
| Rust | `#[allow(...)]`, `#![allow(...)]`, `#[cfg_attr(...allow)]`, `// SAFETY:` |
| Swift | `// swiftlint:disable`, `// swift-format-ignore` |
| PHP | `// phpcs:ignore`, `// @phpstan-ignore`, `@noinspection`, `// psalm-suppress` |
| Shell | `# shellcheck disable` |
| Ruby | `# rubocop: disable`, `# steep:ignore`, `# sorbet: ignore` |

**Examples flagged:**

```python
import os  # noqa: F401                            <- FLAGGED
result = func()  # type: ignore                    <- FLAGGED
# pylint: disable=missing-docstring                <- FLAGGED
```

```typescript
// @ts-ignore                                      <- FLAGGED
// eslint-disable-next-line no-unused-vars          <- FLAGGED
```

```go
resp, _ := http.Get(url) // nolint:errcheck        <- FLAGGED
```

```rust
#[allow(dead_code)]                                <- FLAGGED
```

```java
@SuppressWarnings("unchecked")                     <- FLAGGED
```

**Why this matters:** Lint suppressions hide problems instead of fixing them. In an AI-assisted workflow, the agent should resolve the underlying issue (fix the type, handle the error, refactor the code) rather than silence the tool that found it.

**Relationship to `no_noqa` and `no_type_ignore`:** This rule is a superset. If `no_lint_suppressions` is enabled, it catches everything `no_noqa` and `no_type_ignore` catch plus all other suppression patterns. You can use them independently or together. If you only care about Python-specific suppressions, `no_noqa` and `no_type_ignore` remain available as targeted alternatives.

**When to use `block`:** Recommended for most projects. There is almost never a legitimate reason for an AI agent to add a lint suppression.

**When to use `warn`:** When some suppressions are genuinely required (e.g., `#[allow(dead_code)]` during prototyping, `// SAFETY:` blocks in unsafe Rust).

## no_noqa

**What it catches:** Any line containing `# noqa`, with or without specific error codes.

**Examples flagged:**

```python
import os  # noqa                                  <- FLAGGED
import os  # noqa: F401                            <- FLAGGED
import os  # noqa: E501,F401                       <- FLAGGED
```

**How it works:** Simple regex match for `#\s*noqa` anywhere on the line.

**Why this matters:** `# noqa` tells linters to ignore errors on that line. In an AI-assisted workflow, the correct action is to fix the underlying issue, not suppress the warning. An agent that adds `# noqa` is hiding problems rather than solving them.

**When to use `block`:** Recommended for most projects. There is almost never a legitimate reason for an AI agent to add `# noqa`.

## no_type_ignore

**What it catches:** Any line containing `# type: ignore`, with or without specific error codes.

**Examples flagged:**

```python
result = some_function()  # type: ignore           <- FLAGGED
result = some_function()  # type: ignore[attr-defined]  <- FLAGGED
```

**How it works:** Simple regex match for `#\s*type:\s*ignore` anywhere on the line.

**Why this matters:** Like `# noqa`, `# type: ignore` suppresses type checker errors. An agent should fix the type issue (add proper types, use casts, update signatures) rather than hiding it.

**When to use `block`:** When you have strict type checking (mypy strict mode) and want agents to fix type issues properly.

**When to use `warn`:** When some `# type: ignore` usage is legitimate (e.g., dealing with poorly typed third-party libraries).

## no_helpers_in_routers

**What it catches:** Non-route function definitions in router/controller/endpoint files.

**Examples flagged:**

```python
# In routers/users.py:
from fastapi import APIRouter
router = APIRouter()

def format_response(data):        # <- FLAGGED: not a route handler
    return {"data": data}

def validate_input(payload):      # <- FLAGGED: not a route handler
    if not payload:
        raise ValueError()

@router.get("/users")
async def list_users():           # <- OK: has route decorator
    return []
```

**How it works:**

1. Checks if the file is in a directory classified as a router/controller module (auto-discovered or configured)
2. Extracts all function definitions (Python `def`/`async def`, JavaScript `function`/arrow functions)
3. Finds all route decorator lines (FastAPI, Flask, Django, Express, Go patterns)
4. For each function, checks if a route decorator exists within 3 lines above it
5. Functions without a nearby route decorator are flagged

**Route decorator patterns detected:**

| Framework | Patterns |
|-----------|----------|
| FastAPI | `@app.get()`, `@router.post()`, etc. |
| Flask | `@app.route()`, `@blueprint.get()`, etc. |
| Django | `@api_view`, `@action`, `@require_http_methods` |
| Express | `app.get()`, `router.post()`, `app.use()` |
| Go | `.Get()`, `.Post()`, `.Put()`, etc. |

**Exclusions:**

- Private functions (starting with `_`) are not flagged
- Functions named `main` are not flagged

**When to use `block`:** When your project strictly separates route definitions from business logic (recommended).

**When to use `warn`:** When your project is being migrated and some helpers still live in router files temporarily.

## Custom Rules

Define project-specific rules using regex patterns:

```yaml
conventions:
  custom:
    - pattern: "import pdb"
      message: "Debugger import detected"
      enforcement: warn
    - pattern: "print\\("
      message: "Print statement detected - use logging"
      enforcement: block
    - pattern: "TODO|FIXME|HACK|XXX"
      message: "Task marker detected"
      enforcement: warn
    - pattern: "sleep\\(\\d+\\)"
      message: "Hardcoded sleep detected - use retry logic"
      enforcement: warn
    - pattern: "os\\.environ\\["
      message: "Direct env access - use settings/config module"
      enforcement: warn
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `pattern` | yes | Regular expression matched against each line. Uses JavaScript regex syntax. |
| `message` | yes | Human-readable description shown in violation reports. |
| `enforcement` | no | `warn` (default) or `block`. |

**Tips:**

- Escape backslashes in YAML: `"print\\("` matches `print(`
- Patterns are tested per-line, not across lines
- Use `^` and `$` anchors for line-start/end matching
- Patterns are case-sensitive by default; use `(?i)` for case-insensitive

## Enforcement Behavior

### warn (exit 0 + additionalContext)

```
[Agent Runway] WARNING - Convention violations in /path/to/file.py:
  Rule: no_inline_comments (warn)
    L5: # This explains the algorithm
    L12: x = 1  # increment counter
```

Claude sees this message and can choose to fix the violations on its next turn. The file write was NOT blocked.

### block (exit 2 + stderr)

```
[Agent Runway] BLOCKING - Convention violations in /path/to/file.py:
  Rule: no_noqa (block)
    L8: import os  # noqa: F401
```

The file write is rejected. Claude must fix the violation and retry the edit.

## Validation Scope

Rules only run on code files. The following extensions are considered code:

`.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`, `.go`, `.rs`, `.java`, `.kt`, `.scala`, `.rb`, `.php`, `.swift`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.lua`, `.sh`, `.bash`, `.zsh`

Files matching ignore patterns (from config or defaults) are skipped entirely.
