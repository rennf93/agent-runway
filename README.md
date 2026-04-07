# Agent Runway

> **v1.0.0** — 45 tests passing, 13 languages supported, config validation, deep directory scanning, cross-platform paths. See [Known Limitations](#known-limitations) for edge cases.

A Claude Code plugin that ensures subagents understand your project's architecture, module boundaries, and coding conventions before they write a single line of code.

## Why

When Claude Code delegates work to subagents, those agents operate in complete isolation. They receive no CLAUDE.md rules, no memory, no understanding of your project structure. A subagent asked to "reduce complexity in the router" will happily extract helpers inline instead of moving them to your `helpers/` module. It will add comments to "explain" its changes. It will slap `# noqa` on a linting error instead of fixing it.

Agent Runway fixes this by intercepting subagent creation and injecting architectural context directly into their prompts. It also validates every file write against your project's module boundaries and coding conventions.

## How It Works

The plugin operates at two critical moments, following the runway metaphor:

### Takeoff (Pre-flight)

1. **Session start**: Scans your project structure, reads CLAUDE.md, reads `.agent-runway.yml` config, and builds an architectural map
2. **Agent spawning**: Intercepts every `Agent` tool call via `PreToolUse` hook and injects the architectural map into the subagent's prompt using `updatedInput`

The subagent now knows: which directories exist, what each is for, what's forbidden where, your CLAUDE.md rules, and your coding conventions.

### Landing (Post-flight)

After a subagent writes or edits a file, two `PostToolUse` validators run in parallel:

- **Placement validator**: Was this code written in the correct module? Helpers in `routers/` get flagged. Business logic in `controllers/` gets flagged.
- **Convention validator**: Does the code follow project conventions? Comments, suppressions, and custom patterns are checked across 13 languages.

Each rule is independently configurable as `warn` (Claude self-corrects) or `block` (edit is rejected).

## Installation

### From GitHub (self-hosted marketplace)

```bash
/plugin marketplace add rennf93/claude-agent-runway
/plugin install agent-runway@rennf93
```

### From a local directory (development)

```bash
claude --plugin-dir /path/to/claude-agent-runway
```

## Quick Start

### Zero-config

Agent Runway works out of the box with no configuration. It auto-discovers your project structure and applies sensible defaults. All conventions default to `warn` enforcement.

### With configuration

Create `.agent-runway.yml` in your project root for explicit control:

```yaml
modules:
  routers/:
    purpose: "HTTP endpoint definitions only"
    forbidden:
      - "helper functions"
      - "business logic"
  services/:
    purpose: "Business logic and orchestration"
  helpers/:
    purpose: "Shared utility functions"

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
```

See [Configuration Reference](docs/configuration.md) for the full schema.

## Language Support

Convention validation (comments, lint suppressions) works across:

| Language | Comment Style | Suppressions Detected |
|----------|--------------|----------------------|
| Python | `#` | `noqa`, `type: ignore`, `pylint: disable`, `pragma: no cover`, `fmt: off`, `isort: skip`, `mypy: ignore` |
| TypeScript/JS | `//` | `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `biome-ignore`, `prettier-ignore`, `c8/istanbul/v8 ignore` |
| Go | `//` | `nolint`, `nosec`, `go:nosplit`, `go:noinline`, `exhaustive:ignore` |
| Java | `//` | `@SuppressWarnings`, `CHECKSTYLE: OFF`, `NOSONAR`, `NOPMD`, `spotbugs:ignore` |
| Kotlin | `//` | `@Suppress`, `ktlint-disable`, `@file:Suppress` |
| Scala | `//` | `scalafix:off`, `scalastyle:off`, `@SuppressWarnings` |
| C/C++ | `//` | `NOLINT`, `NOLINTNEXTLINE`, `pragma warning(disable)`, `GCC/clang diagnostic ignored` |
| C# | `//` | `pragma warning disable`, `ReSharper disable`, `SuppressMessage` |
| Rust | `//` | `#[allow(...)]`, `#![allow(...)]` |
| Swift | `//` | `swiftlint:disable`, `swift-format-ignore` |
| PHP | `//` | `phpcs:ignore`, `@phpstan-ignore`, `@noinspection`, `psalm-suppress` |
| Shell | `#` | `shellcheck disable` |
| Ruby | `#` | `rubocop: disable`, `steep:ignore`, `sorbet: ignore` |

## What Gets Injected

When a subagent spawns, its prompt is prepended with:

```
=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===

Project: my-project

Module Boundaries:
- routers/ -> HTTP route/endpoint definitions. NO: helper functions, business logic
- services/ -> Business logic and orchestration. NO: route definitions
- helpers/ -> Shared utility/helper functions
- tests/ -> Test suite. NO: production code

Mandatory Conventions:
- NO INLINE COMMENTS [block]
- NO LINT SUPPRESSIONS [block]
- NO HELPERS IN ROUTERS [block]

CLAUDE.md Rules (MANDATORY):
- DO NOT LEAVE ANY COMMENTS IN THE CODE
- ASK QUESTIONS BEFORE YOU DO ANYTHING

=== END ARCHITECTURAL CONTEXT ===

[original task prompt follows]
```

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration Reference](docs/configuration.md) | Full `.agent-runway.yml` schema with all options |
| [Architecture](docs/architecture.md) | How the plugin works internally, hook flow, data model |
| [Built-in Rules](docs/rules.md) | All convention rules and what they catch |
| [Examples](docs/examples.md) | Ready-to-use configs for Python, TypeScript, Go, and monorepo projects |
| [Contributing](CONTRIBUTING.md) | How to contribute to the plugin |
| [Testing](TESTING.md) | How to test the plugin locally |

## Skills

| Skill | Description |
|-------|-------------|
| `/agent-runway:runway-status` | Display the current architectural map, active conventions, and enforcement levels |

## Known Limitations

### Comment detection is regex-based, not AST-based

String literals are stripped before checking (preventing most false positives like `"#FF0000"` or `"https://example.com#section"`), but edge cases with complex string interpolation or multiline strings may slip through.

### Placement heuristics rely on function names

The placement validator classifies functions as "helpers" based on name prefixes (`format_*`, `parse_*`, `helper_*`, etc.). Route decorators are detected and excluded, but undecorated functions with ambiguous names may be misclassified. Use `.agent-runway.yml` to fine-tune module boundaries if needed.

### No Windows CI

Path handling uses `os.tmpdir()` and `path.join` (cross-platform), but no CI testing on Windows has been done yet. Community reports welcome.

## Requirements

- Claude Code CLI
- Node.js >= 18

## License

MIT
