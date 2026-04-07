# Contributing

## Setup

```bash
git clone https://github.com/rennf93/claude-agent-runway.git
cd claude-agent-runway
npm install
```

## Project Structure

```
scripts/
  scan-project.mjs          # SessionStart hook
  inject-context.mjs        # PreToolUse(Agent) hook
  validate-placement.mjs    # PostToolUse(Write|Edit) hook
  validate-conventions.mjs  # PostToolUse(Write|Edit) hook
  lib/
    io.mjs                  # Hook I/O helpers (stdin/stdout JSON)
    config.mjs              # .agent-runway.yml parser and defaults
    scanner.mjs             # Directory structure analyzer
    rules.mjs               # Convention rule implementations
```

## How Hooks Work

Each script is a standalone Node.js process. Claude Code runs it as a shell command, pipes JSON to stdin, and reads JSON from stdout.

**Input (stdin):**

```json
{
  "tool_input": { "file_path": "/path/to/file.py" },
  "session_context": { "working_directory": "/path/to/project" }
}
```

**Output (stdout):**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Warning message here"
  }
}
```

**Exit codes:**

- `0` — success (allow the operation, optionally with context)
- `2` — block (reject the operation, stderr message shown to Claude)

## Testing Scripts Manually

Every script can be tested outside Claude Code by piping JSON:

```bash
echo '{"session_context":{"working_directory":"/your/project"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/test node scripts/scan-project.mjs

echo '{"tool_input":{"prompt":"Do something","subagent_type":"general-purpose"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/test node scripts/inject-context.mjs

echo '{"tool_input":{"file_path":"/path/to/file.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/test node scripts/validate-conventions.mjs
```

## Testing in a Real Session

```bash
cd /your/project
claude --plugin-dir /path/to/claude-agent-runway -d "hooks"
```

The `-d "hooks"` flag shows debug output for hook execution.

## Adding a New Built-in Rule

1. Add the check function in `scripts/lib/rules.mjs`:

```javascript
export function checkNewRule(lines) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (/* condition */) {
      violations.push({ line: i + 1, content: lines[i].trim() });
    }
  }
  return violations;
}
```

2. Add the default config in `scripts/lib/config.mjs` under `DEFAULT_CONVENTIONS`:

```javascript
const DEFAULT_CONVENTIONS = {
  // ...existing rules
  new_rule: { enabled: true, enforcement: "warn" },
};
```

3. Wire it up in `scripts/validate-conventions.mjs`:

```javascript
import { checkNewRule } from "./lib/rules.mjs";

// In main():
if (conventions.new_rule?.enabled) {
  collect("new_rule", conventions.new_rule.enforcement, checkNewRule(lines));
}
```

4. Document it in `docs/rules.md`.

## Adding a New Module Pattern

Add the directory name and purpose to `KNOWN_MODULE_PURPOSES` in `scripts/lib/scanner.mjs`:

```javascript
const KNOWN_MODULE_PURPOSES = {
  // ...existing patterns
  repositories: "Data access layer",
};
```

If it should have forbidden definitions, add logic in `buildModuleInfo()`.

## Code Style

- No comments in code (the code reads itself)
- No `// eslint-disable` or similar suppressions
- Use ES modules (`.mjs` extension, `import`/`export`)
- Handle errors gracefully (exit 0, log to stderr)
- Keep scripts independent (no shared state between hooks)

## Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test manually with `echo | node scripts/...`
5. Test in a real Claude Code session with `--plugin-dir`
6. Open a pull request
