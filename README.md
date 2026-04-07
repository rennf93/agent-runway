# Agent Runway

A Claude Code plugin that gives subagents architectural awareness before they write code.

## The Problem

When Claude Code delegates work to subagents, those agents operate in complete isolation. They receive no CLAUDE.md rules, no memory, no understanding of your project structure. A subagent asked to "reduce complexity in the router" will happily extract helpers inline instead of moving them to your `helpers/` module. It will add comments to "explain" its changes. It will slap `# noqa` on a linting error instead of fixing it.

## The Fix

Agent Runway intercepts every subagent spawn and injects your project's architectural context directly into its prompt. No configuration needed. The subagent just knows.

Install it, forget about it, and your subagents stop creating tech debt.

## What Happens

On **session start**, the plugin scans your project: directory structure, module purposes, CLAUDE.md rules. It caches this as an architectural map.

When Claude **spawns a subagent**, the plugin intercepts the `Agent` tool call and prepends the map to the subagent's prompt via `updatedInput`. The subagent now knows which directories exist, what each is for, what's forbidden where, and your project's rules.

This is what a subagent sees before its task:

```
=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===

Project: my-project

Module Boundaries:
- routers/ -> HTTP route/endpoint definitions. NO: helper functions, business logic
- services/ -> Business logic and orchestration. NO: route definitions
- helpers/ -> Shared utility/helper functions
- tests/ -> Test suite. NO: production code

Mandatory Conventions:
- NO INLINE COMMENTS [warn]
- NO LINT SUPPRESSIONS [warn]
- NO HELPERS IN ROUTERS [warn]

CLAUDE.md Rules (MANDATORY):
- DO NOT LEAVE ANY COMMENTS IN THE CODE
- ASK QUESTIONS BEFORE YOU DO ANYTHING

=== END ARCHITECTURAL CONTEXT ===

[original task prompt follows]
```

No extra tokens in your main conversation. No agent definitions to modify. It just works.

## Installation

### From GitHub

```bash
/plugin marketplace add rennf93/agent-runway
/plugin install agent-runway@rennf93
```

### Local development

```bash
claude --plugin-dir /path/to/agent-runway
```

## Zero Config Required

Agent Runway works out of the box. It auto-discovers your project structure by matching directory names against 25+ known patterns (`routers/`, `services/`, `helpers/`, `models/`, `tests/`, `middleware/`, `adapters/`, etc.) and infers purpose for unknown directories by sampling code files. It extracts imperative rules from your CLAUDE.md automatically.

No `.agent-runway.yml` needed unless you want explicit control.

## Optional: Post-landing Validation

Agent Runway also validates code **after** a subagent writes it. All rules are **enabled in warn mode by default** — violations are reported to Claude so it self-corrects on the next turn. The edit is never blocked unless you explicitly opt in.

Two validators run after each Write/Edit:

- **Convention validator**: Flags comments, lint suppressions, and custom patterns across 13 languages
- **Placement validator**: Flags code written in the wrong module (helpers in routers, business logic in controllers)

### Opting into block mode

Block mode rejects the edit entirely, forcing Claude to fix the issue and retry. Only use this when you're confident in the rule — false positives will cause friction.

```yaml
conventions:
  no_inline_comments:
    enabled: true
    enforcement: block
```

### Supported Languages

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

See [Built-in Rules](docs/rules.md) for details on each rule.

## Configuration

Create `.agent-runway.yml` in your project root only if you need to:

- Override auto-discovered module purposes or forbidden definitions
- Set specific rules to `block` enforcement
- Add custom regex patterns
- Tune context injection size

See [Configuration Reference](docs/configuration.md) for the full schema and [Examples](docs/examples.md) for ready-to-use configs for FastAPI, Django, Flask, Next.js, Express, Go, and monorepos.

## Skills

| Skill | Description |
|-------|-------------|
| `/agent-runway:runway-status` | Display the current architectural map, active conventions, and enforcement levels |

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration Reference](docs/configuration.md) | Full `.agent-runway.yml` schema |
| [Architecture](docs/architecture.md) | How the plugin works internally |
| [Built-in Rules](docs/rules.md) | All convention rules and what they catch |
| [Examples](docs/examples.md) | Per-language and monorepo configs |
| [Contributing](CONTRIBUTING.md) | How to contribute |
| [Testing](TESTING.md) | How to test locally |

## Known Limitations

**Comment detection is regex-based.** String literals are stripped before checking (preventing most false positives), but edge cases with complex interpolation may slip through.

**Placement heuristics use function names.** Route decorators are detected and excluded, but undecorated functions with ambiguous names may be misclassified.

**No Windows CI.** Path handling is cross-platform (`os.tmpdir()`, `path.join`), but untested in CI.

## Requirements

- Claude Code CLI
- Node.js >= 18

## License

MIT
