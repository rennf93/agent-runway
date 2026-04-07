# Architecture

## Overview

Agent Runway is a hook-based Claude Code plugin. It has no MCP server, no persistent process, and no external dependencies beyond `js-yaml`. Each hook script is a standalone Node.js process that reads JSON from stdin, does its job, and writes JSON to stdout.

```
Session Start
    |
    v
[scan-project.mjs] --> arch-map.json (cached to CLAUDE_PLUGIN_DATA)
    |
    v
User asks Claude to delegate work
    |
    v
Claude calls Agent tool
    |
    v
[inject-context.mjs] --> reads arch-map.json, modifies Agent prompt via updatedInput
    |
    v
Subagent spawns WITH architectural context in its prompt
    |
    v
Subagent calls Write or Edit
    |
    v
[validate-placement.mjs] --> checks module boundaries
[validate-conventions.mjs] --> checks coding conventions
    |
    v
warn (additionalContext) or block (exit 2)
```

## Hook Events

| Hook | Event | Matcher | Script | Purpose |
|------|-------|---------|--------|---------|
| SessionStart | Session begins | (all) | `scan-project.mjs` | Build architectural map |
| PreToolUse | Before tool executes | `Agent` | `inject-context.mjs` | Inject context into subagent prompt |
| PostToolUse | After tool succeeds | `Write\|Edit` | `validate-placement.mjs` | Check module boundaries |
| PostToolUse | After tool succeeds | `Write\|Edit` | `validate-conventions.mjs` | Check coding conventions |

## Data Flow

### 1. SessionStart: Project Scanning

**Input:** JSON on stdin with `session_context.working_directory`

**Process:**

1. Load `.agent-runway.yml` if it exists (via `lib/config.mjs`)
2. Scan project directories (via `lib/scanner.mjs`):
   - List top-level directories, skip non-code dirs (`docs/`, `site/`, `public/`, etc.)
   - Match against 25+ known directory patterns (`routers/`, `services/`, `helpers/`, etc.)
   - For unknown directories, sample up to 3 code files and infer purpose from class/function signatures
   - Scan one level of subdirectories for additional known patterns
3. Extract CLAUDE.md rules:
   - Check `CLAUDE.md` and `.claude/CLAUDE.md`
   - Extract lines containing imperative language (DO NOT, NEVER, MUST, ALWAYS, etc.)
   - Filter out noise (dependency names, file tree entries, code blocks)
4. Merge user config with auto-discovered structure
5. Pre-render the context block (the text that will be injected into subagent prompts)
6. Write everything to `${CLAUDE_PLUGIN_DATA}/arch-map.json`

**Output:** JSON with `additionalContext` summarizing what was scanned.

### 2. PreToolUse on Agent: Context Injection

**Input:** JSON on stdin with `tool_input.prompt` (the subagent's task description)

**Process:**

1. Read cached `arch-map.json` from `${CLAUDE_PLUGIN_DATA}`
2. Check if context was already injected (avoid double-injection on retries)
3. Prepend the pre-rendered context block to the prompt
4. Return the full original `tool_input` with the modified `prompt` field

**Output:** JSON with `permissionDecision: "allow"` and `updatedInput` containing the augmented prompt.

**Key mechanism:** The `updatedInput` field in a PreToolUse hook response replaces the tool's input parameters before execution. For the Agent tool, this means we can modify the `prompt` field that becomes the subagent's task description. This is fully automatic — no agent definitions need to be modified.

### 3. PostToolUse on Write|Edit: Convention Validation

**Input:** JSON on stdin with `tool_input.file_path`

**Process:**

1. Skip non-code files (check extension against known code types)
2. Skip ignored files (match against ignore patterns from config)
3. Read the file content from disk
4. Run all enabled convention rules against each line:
   - `no_inline_comments`: Regex-based, excludes shebangs/encodings/type-hints/pragmas
   - `no_noqa`: Simple pattern match
   - `no_type_ignore`: Simple pattern match
   - `no_helpers_in_routers`: Only runs if file is in a router directory. Extracts function definitions, checks which have route decorators, flags those without.
   - `custom`: User-defined regex patterns
5. Collect violations, grouped by enforcement level

**Output:**

- No violations: silent exit (exit 0, no output)
- Warnings only: JSON with `additionalContext` listing violations
- Any blocking violations: exit code 2 with violation details on stderr

### 4. PostToolUse on Write|Edit: Placement Validation

**Input:** JSON on stdin with `tool_input.file_path`

**Process:**

1. Skip non-code files and ignored files
2. Determine which module the file belongs to (longest matching module path)
3. If the module has no `forbidden` list, skip
4. Extract all function and class definitions from the file
5. Classify each definition: helper function, business logic, data model, test function, etc.
6. Check if any classification matches a forbidden type for this module

**Output:** Same as convention validation (silent, warn, or block).

## Architectural Map (arch-map.json)

The cached architectural map is the central data structure. It's written once at session start and read by all subsequent hooks.

```json
{
  "project_name": "fastapi-guard",
  "working_directory": "/path/to/project",
  "scanned_at": "2026-04-07T18:00:00Z",
  "modules": {
    "guard/": {
      "purpose": "Adapter package over guard-core",
      "allowed": ["middleware classes", "adapter classes"],
      "forbidden": ["helper functions", "business logic"]
    },
    "tests/": {
      "purpose": "Test suite",
      "allowed": ["test functions", "fixtures"],
      "forbidden": ["production code", "business logic"]
    }
  },
  "conventions": {
    "no_inline_comments": { "enabled": true, "enforcement": "block" },
    "no_noqa": { "enabled": true, "enforcement": "block" },
    "no_type_ignore": { "enabled": true, "enforcement": "warn" },
    "no_helpers_in_routers": { "enabled": true, "enforcement": "block" },
    "custom": []
  },
  "claude_md_rules": [
    "DO NOT LEAVE ANY COMMENTS IN THE CODE",
    "ASK QUESTIONS BEFORE YOU DO ANYTHING"
  ],
  "ignore": ["*.md", "docs/", ".git/"],
  "context": {
    "max_size": 3000,
    "include_claude_md": "summary",
    "extra_instructions": ""
  },
  "context_block": "... pre-rendered text for injection ..."
}
```

## File Structure

```
agent-runway/
  .claude-plugin/
    plugin.json               # Plugin manifest (name, version, author)
  hooks/
    hooks.json                # Hook event -> script mapping
  scripts/
    scan-project.mjs          # SessionStart hook entry point
    inject-context.mjs        # PreToolUse(Agent) hook entry point
    validate-placement.mjs    # PostToolUse(Write|Edit) hook entry point
    validate-conventions.mjs  # PostToolUse(Write|Edit) hook entry point
    lib/
      io.mjs                  # readStdin(), respond(), block(), warn()
      config.mjs              # loadConfig(), isCodeFile(), shouldIgnoreFile()
      scanner.mjs             # scanProject(), extractClaudeMdRules(), getModuleForFile()
      rules.mjs               # checkNoInlineComments(), checkNoNoqa(), etc.
  skills/
    runway-status/
      SKILL.md                # Skill for inspecting current state
  package.json                # js-yaml dependency
  README.md
  TESTING.md
  CONTRIBUTING.md
  LICENSE
  docs/
    configuration.md          # Full config reference
    architecture.md           # This file
    rules.md                  # Built-in rule details
    examples.md               # Per-language config examples
```

## Design Decisions

### Why PreToolUse + updatedInput instead of Skills?

Skills listed in an agent's `skills:` frontmatter get injected into the subagent's context. But this requires every agent definition to include `skills: [agent-runway:...]`. Users of third-party agents (or Claude's built-in agents like Explore/Plan) cannot modify those definitions. The PreToolUse hook on the Agent tool is universal — it intercepts ALL subagent spawns regardless of how they're defined.

### Why cache at SessionStart instead of scanning on every Agent call?

Project structure doesn't change during a session. Scanning once and caching avoids 1-2 seconds of filesystem scanning on every subagent spawn. The arch-map.json is typically under 5KB and reads in milliseconds.

### Why separate placement and convention validators?

They check fundamentally different things. Convention validation is line-by-line pattern matching (fast, deterministic). Placement validation requires understanding the file's module context and classifying its definitions (slower, heuristic). Separating them allows independent configuration and makes each script easier to maintain.

### Why exit 0 on errors instead of crashing?

Hook scripts that crash or timeout can block Claude Code sessions. All scripts catch top-level errors and exit 0 (allowing the operation to proceed) rather than crashing. Errors are logged to stderr for debugging.

### Why Node.js instead of Python or Bash?

Node.js is the standard runtime for Claude Code plugins (claude-mem, code-review, etc.). It handles JSON natively, is guaranteed available where Claude Code runs, and has no additional dependencies. The only npm dependency is `js-yaml` for config parsing.

## Environment Variables

| Variable | Set By | Description |
|----------|--------|-------------|
| `CLAUDE_PLUGIN_ROOT` | Claude Code | Plugin installation directory. Used in hooks.json commands. |
| `CLAUDE_PLUGIN_DATA` | Claude Code | Persistent data directory. Survives plugin updates. Where arch-map.json is stored. |

## Limitations

- **No cross-session state**: The architectural map is rebuilt every session. This is by design (project structure may change between sessions).
- **Heuristic classification**: Placement validation classifies functions by name patterns (e.g., `format_*` = helper). This can produce false positives for ambiguous names.
- **Single-level subdirectory scanning**: The scanner checks one level deep for known patterns. Deeply nested module structures may need explicit config.
- **No AST parsing**: Convention and placement rules use regex, not AST. This is fast but can miss edge cases (e.g., comments inside multiline strings).
