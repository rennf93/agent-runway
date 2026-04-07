# Configuration Reference

Agent Runway is configured via `.agent-runway.yml` in your project root. All fields are optional. Without a config file, the plugin auto-discovers your project structure and applies default conventions with `warn` enforcement.

## Full Schema

```yaml
# Module boundary definitions
# Supplements auto-discovery. Explicit definitions take precedence.
modules:
  <directory-path>/:
    purpose: <string>           # What this module is for
    allowed:                    # What kind of code belongs here
      - <string>
    forbidden:                  # What kind of code must NOT go here
      - <string>

# Convention rules
conventions:
  no_inline_comments:
    enabled: <bool>             # Default: true
    enforcement: <warn|block>   # Default: warn
  no_lint_suppressions:
    enabled: <bool>             # Default: true
    enforcement: <warn|block>   # Default: warn
  no_noqa:
    enabled: <bool>             # Default: true
    enforcement: <warn|block>   # Default: warn
  no_type_ignore:
    enabled: <bool>             # Default: true
    enforcement: <warn|block>   # Default: warn
  no_helpers_in_routers:
    enabled: <bool>             # Default: true
    enforcement: <warn|block>   # Default: warn
  custom:                       # Custom regex-based rules
    - pattern: <regex-string>
      message: <string>
      enforcement: <warn|block> # Default: warn

# Files and directories to skip during validation
ignore:
  - <glob-pattern>

# Context injection settings
context:
  max_size: <number>            # Default: 3000 (characters)
  include_claude_md: <string>   # "summary" (default) or "full"
  extra_instructions: <string>  # Additional text injected into every subagent
```

## Sections

### modules

Defines what each directory in your project is for and what code is allowed or forbidden.

```yaml
modules:
  guard/:
    purpose: "Adapter package over guard-core - middleware and adapters only"
    allowed:
      - "middleware classes"
      - "adapter classes"
      - "protocol adapters"
    forbidden:
      - "helper functions"
      - "business logic"
      - "data models"
      - "test functions"
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `purpose` | string | Human-readable description of what this module is for. Injected into subagent context. |
| `allowed` | list of strings | Types of code that belong in this module. Used for documentation/context. |
| `forbidden` | list of strings | Types of code that must NOT be placed here. Used by the placement validator. |

**Path format:** Always use trailing slashes (e.g., `guard/`, not `guard`). Paths are relative to the project root.

**Merging with auto-discovery:** If a module is both auto-discovered and defined in config, the config values take precedence. Undefined fields fall back to auto-discovered values.

**Auto-discovered module types:**

| Directory Pattern | Auto-assigned Purpose | Auto-assigned Forbidden |
|-------------------|-----------------------|------------------------|
| `routers/`, `routes/`, `controllers/`, `endpoints/`, `views/` | HTTP route/endpoint definitions | helper functions, utility functions, business logic, data models |
| `services/`, `handlers/` | Business logic and orchestration | route definitions, endpoint handlers |
| `helpers/`, `utils/`, `utilities/`, `lib/` | Shared utility functions | route definitions, endpoint handlers, middleware |
| `models/`, `schemas/` | Data models and schemas | business logic, route handlers, utility functions |
| `tests/`, `test/`, `specs/` | Test suite | production code, business logic |
| `middleware/` | Middleware components | route handlers, data models |
| `core/` | Core application logic | (none) |
| `adapters/` | Adapter/integration layer | (none) |
| `decorators/` | Function/class decorators | (none) |
| `protocols/` | Interface/protocol definitions | (none) |
| `config/`, `settings/` | Configuration modules | (none) |
| `migrations/` | Database migrations | (none) |
| `examples/` | Example implementations | (none) |

Directories not matching any known pattern are analyzed by sampling code files to infer purpose.

### conventions

Controls which coding conventions are checked after every file write or edit.

```yaml
conventions:
  no_inline_comments:
    enabled: true
    enforcement: block
  no_lint_suppressions:
    enabled: true
    enforcement: block
  no_noqa:
    enabled: true
    enforcement: block
  no_type_ignore:
    enabled: true
    enforcement: warn
  no_helpers_in_routers:
    enabled: true
    enforcement: block
  custom:
    - pattern: "import pdb"
      message: "Debugger import detected"
      enforcement: warn
    - pattern: "print\\("
      message: "Print statement detected - use logging"
      enforcement: block
```

**Built-in rules:**

| Rule | Default | What it catches |
|------|---------|----------------|
| `no_inline_comments` | enabled, warn | Standalone comments (`#` and `//`) and inline comments. Supports Python, Ruby, Shell (`#`) and JS, TS, Go, Rust, Java, C, C++, Swift, Kotlin, Scala, C# (`//`). Excludes shebangs, encoding declarations, type hints, and pragmas. |
| `no_lint_suppressions` | enabled, warn | Lint suppression directives across all supported languages: `# noqa`, `// @ts-ignore`, `// nolint`, `@SuppressWarnings`, `#[allow(...)]`, and many more. See [Built-in Rules](rules.md) for the full list. |
| `no_noqa` | enabled, warn | Python-specific `# noqa` suppression. Subset of `no_lint_suppressions`. |
| `no_type_ignore` | enabled, warn | Python-specific `# type: ignore` suppression. Subset of `no_lint_suppressions`. |
| `no_helpers_in_routers` | enabled, warn | Non-route function definitions in router/controller/endpoint files. Detects route decorators from FastAPI, Flask, Django, Express, and Go frameworks. |

**Custom rules:**

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | string | Regular expression to match against each line. |
| `message` | string | Human-readable description shown when the pattern is found. |
| `enforcement` | `warn` or `block` | How to handle violations. Default: `warn`. |

See [Built-in Rules](rules.md) for detailed behavior of each rule.

### ignore

Glob patterns for files and directories to skip during validation. Placement and convention validators will not check files matching these patterns.

```yaml
ignore:
  - "*.md"
  - "*.yml"
  - "*.yaml"
  - "*.json"
  - "*.toml"
  - "*.lock"
  - "*.txt"
  - "docs/"
  - ".git/"
  - "node_modules/"
  - "__pycache__/"
```

**Default ignore patterns** (applied when no `ignore` key is present):

`*.md`, `*.yml`, `*.yaml`, `*.json`, `*.toml`, `*.lock`, `*.txt`, `*.csv`, `*.svg`, `*.png`, `*.jpg`, `*.gif`, `*.ico`, `docs/`, `.git/`, `node_modules/`, `__pycache__/`, `.venv/`, `venv/`

**Pattern types:**

| Pattern | Matches |
|---------|---------|
| `*.md` | Any file ending in `.md` |
| `docs/` | Any path containing `docs/` |
| `test_data/fixtures.py` | Exact file match |

### context

Controls how architectural context is injected into subagent prompts.

```yaml
context:
  max_size: 3000
  include_claude_md: summary
  extra_instructions: |
    This project uses uv for package management.
    Run tests with: REDIS_URL=redis://localhost:6379 uv run pytest
    Always use absolute imports.
```

**Fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_size` | number | 3000 | Maximum characters injected into subagent prompts. Prevents context bloat. The block is truncated with `[...truncated]` if it exceeds this limit. |
| `include_claude_md` | string | `"summary"` | `"summary"` extracts only imperative rules (DO NOT, NEVER, MUST, etc.). `"full"` includes the entire CLAUDE.md content (uses more of max_size budget). |
| `extra_instructions` | string | `""` | Free-form text appended to the context block. Use for project-specific instructions that aren't in CLAUDE.md (build commands, test setup, etc.). |

## Enforcement Levels

Every rule supports two enforcement levels:

### warn (default)

The violation is reported to Claude via `additionalContext` in the hook response. Claude sees the warning and can self-correct on its next turn. The file write is NOT blocked.

Use `warn` when:

- You're first adopting the plugin and want to observe what it catches
- The rule has potential false positives
- You prefer Claude to learn and adapt rather than be hard-blocked

### block

The file write is rejected via exit code 2. Claude is forced to undo or redo the edit. The violation details are written to stderr and shown to Claude.

Use `block` when:

- The rule is critical and non-negotiable (e.g., no comments in code)
- False positives are rare for this rule
- You want hard enforcement rather than suggestions

## Precedence

1. `.agent-runway.yml` explicit values take highest precedence
2. Auto-discovered module structure fills in gaps
3. Built-in defaults apply for any remaining undefined values

## File Location

The config file must be at the project root:

```
your-project/
  .agent-runway.yml    <-- here
  src/
  tests/
  CLAUDE.md
```

For monorepos with per-service configs, place `.agent-runway.yml` in each service directory. The scanner uses the working directory as the project root.
