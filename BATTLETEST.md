# Agent Runway — Battle Test Plan

You are testing a Claude Code plugin called **agent-runway**. Your job is to find every bug, edge case, false positive, and missing feature. Be adversarial. Break things. Then fix them.

## Context

This plugin does three things:

1. **SessionStart**: Scans the project directory, reads CLAUDE.md and `.agent-runway.yml`, builds an architectural map cached to `${CLAUDE_PLUGIN_DATA}/arch-map.json`
2. **PreToolUse(Agent)**: Intercepts every subagent spawn and injects the architectural map into the subagent's prompt via `updatedInput`
3. **PostToolUse(Write|Edit)**: Validates every file write against module boundaries and coding conventions

The source code is in this repository. Read every file before doing anything.

## Ground Rules

- Read ALL source files first: `scripts/`, `scripts/lib/`, `hooks/`, `.claude-plugin/`
- Run `npm install` if `node_modules/` is missing
- Do NOT modify source code until Phase 5. Phases 1-4 are diagnosis only.
- Log every issue you find with: file path, line number, what's wrong, severity (critical/major/minor)
- After Phase 4, compile a full issues list. Then fix everything in Phase 5.

---

## Phase 1: Unit Tests for Each Script

Test each script in isolation by piping JSON to stdin. Every test must verify both the stdout JSON structure AND the exit code.

### 1.1 scan-project.mjs

Run against this repo itself:

```bash
echo '{"session_context":{"working_directory":"'$(pwd)'"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/scan-project.mjs
```

Verify:
- [ ] Output is valid JSON with `hookSpecificOutput.additionalContext`
- [ ] `arch-map.json` was written to `/tmp/ar-test/`
- [ ] `arch-map.json` contains `project_name`, `modules`, `conventions`, `claude_md_rules`, `context_block`
- [ ] `docs/` directory is NOT in the modules list (it's a non-code directory)
- [ ] `scripts/` IS in the modules list
- [ ] `context_block` is under 3000 characters

Now test edge cases:

```bash
# Empty directory
mkdir -p /tmp/ar-empty && echo '{"session_context":{"working_directory":"/tmp/ar-empty"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test-empty node scripts/scan-project.mjs
```

- [ ] Does not crash on empty project
- [ ] Produces valid JSON output
- [ ] `arch-map.json` has empty modules

```bash
# Directory that doesn't exist
echo '{"session_context":{"working_directory":"/tmp/nonexistent-dir-12345"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test-nodir node scripts/scan-project.mjs
```

- [ ] Does not crash (exit 0)
- [ ] Handles missing directory gracefully

```bash
# No stdin at all (empty input)
echo '' | CLAUDE_PLUGIN_DATA=/tmp/ar-test-noinput node scripts/scan-project.mjs
```

- [ ] Does not crash
- [ ] Falls back to cwd

```bash
# Malformed JSON on stdin
echo 'not json' | CLAUDE_PLUGIN_DATA=/tmp/ar-test-badjson node scripts/scan-project.mjs
```

- [ ] Does not crash
- [ ] Falls back gracefully

```bash
# Missing CLAUDE_PLUGIN_DATA env var
echo '{"session_context":{"working_directory":"'$(pwd)'"}}' \
  | node scripts/scan-project.mjs
```

- [ ] Falls back to `/tmp/agent-runway` or similar
- [ ] Works on the current OS (check if fallback path exists on Windows/Linux)

### 1.2 inject-context.mjs

First, ensure an arch-map exists from the scan-project test above, then:

```bash
# Normal injection
echo '{"tool_input":{"prompt":"Refactor middleware","subagent_type":"general-purpose"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/inject-context.mjs
```

Verify:
- [ ] Output JSON has `hookSpecificOutput.updatedInput.prompt`
- [ ] The prompt starts with `=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===`
- [ ] The original prompt "Refactor middleware" appears AFTER the context block
- [ ] `permissionDecision` is `"allow"`
- [ ] ALL other fields from `tool_input` are preserved in `updatedInput` (not just prompt)

Edge cases:

```bash
# No prompt field
echo '{"tool_input":{"subagent_type":"general-purpose"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/inject-context.mjs
echo "Exit: $?"
```

- [ ] Exits 0 silently (no injection needed)

```bash
# No arch-map.json
echo '{"tool_input":{"prompt":"Do something"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test-nomap node scripts/inject-context.mjs
echo "Exit: $?"
```

- [ ] Exits 0 silently (nothing to inject)

```bash
# Already-injected prompt (double injection prevention)
echo '{"tool_input":{"prompt":"=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===\nstuff\n=== END ===\nOriginal prompt"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/inject-context.mjs
```

- [ ] Does NOT double-inject
- [ ] Either exits silently or returns the prompt unchanged

```bash
# Very long prompt (test max_size truncation)
LONG_PROMPT=$(python3 -c "print('x' * 10000)")
echo "{\"tool_input\":{\"prompt\":\"$LONG_PROMPT\"}}" \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/inject-context.mjs | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log('Total prompt length:', j.hookSpecificOutput.updatedInput.prompt.length);
  "
```

- [ ] Context block portion respects max_size (original prompt is NOT truncated, only context block)

### 1.3 validate-conventions.mjs

Create test files with known violations:

```bash
# File with every violation type
cat > /tmp/ar-conv-test.py << 'PYEOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# This is a comment that should be caught
x = 1  # inline comment

import os  # noqa: F401
result = foo()  # type: ignore

def clean_function():
    return True
PYEOF

echo '{"tool_input":{"file_path":"/tmp/ar-conv-test.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/validate-conventions.mjs 2>&1
echo "Exit: $?"
```

Verify:
- [ ] Line 4 (`# This is a comment`) is flagged
- [ ] Line 5 (`# inline comment`) is flagged
- [ ] Line 7 (`# noqa`) is flagged
- [ ] Line 8 (`# type: ignore`) is flagged
- [ ] Line 1 (shebang) is NOT flagged
- [ ] Line 2 (encoding) is NOT flagged
- [ ] Line 10-11 (clean function) is NOT flagged
- [ ] Exit code matches enforcement level (0 for warn, 2 for block)

More edge cases:

```bash
# Non-code file (should be skipped)
echo '{"tool_input":{"file_path":"/tmp/test.md"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/validate-conventions.mjs
echo "Exit: $?"
```

- [ ] Exits 0 silently

```bash
# File that doesn't exist
echo '{"tool_input":{"file_path":"/tmp/nonexistent-file-12345.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/validate-conventions.mjs
echo "Exit: $?"
```

- [ ] Exits 0 (does not crash)

```bash
# No file_path in input
echo '{"tool_input":{}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/validate-conventions.mjs
echo "Exit: $?"
```

- [ ] Exits 0 (does not crash)

```bash
# TypeScript file with TS-specific patterns
cat > /tmp/ar-conv-test.ts << 'TSEOF'
// This is a TypeScript comment
const x = 1; // inline comment
// @ts-ignore
const y: any = foo();
TSEOF

echo '{"tool_input":{"file_path":"/tmp/ar-conv-test.ts"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-test node scripts/validate-conventions.mjs 2>&1
echo "Exit: $?"
```

- [ ] What happens with `//` comments? The rule checks for `#` — does it miss `//` style comments entirely?
- [ ] Is this a gap? Should there be language-aware comment detection?

### 1.4 validate-placement.mjs

```bash
# Create a router directory with a helper function
mkdir -p /tmp/ar-place-test/routers
cat > /tmp/ar-place-test/routers/users.py << 'PYEOF'
from fastapi import APIRouter

router = APIRouter()

def format_user_response(user):
    return {"id": user.id}

def validate_user_input(data):
    return bool(data.get("name"))

@router.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"user_id": user_id}
PYEOF

# First scan the test project
echo '{"session_context":{"working_directory":"/tmp/ar-place-test"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-place-test-data node scripts/scan-project.mjs

# Then validate
echo '{"tool_input":{"file_path":"/tmp/ar-place-test/routers/users.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-place-test-data node scripts/validate-placement.mjs 2>&1
echo "Exit: $?"
```

Verify:
- [ ] `format_user_response` is flagged (helper in router)
- [ ] `validate_user_input` is flagged (helper in router)
- [ ] `get_user` is NOT flagged (has route decorator)

More edge cases:

```bash
# File NOT in any module
echo '{"tool_input":{"file_path":"/tmp/random-standalone-file.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-place-test-data node scripts/validate-placement.mjs
echo "Exit: $?"
```

- [ ] Exits 0 (no module context, nothing to validate)

```bash
# File in a module with no forbidden list
mkdir -p /tmp/ar-place-test/config
cat > /tmp/ar-place-test/config/settings.py << 'PYEOF'
DATABASE_URL = "postgresql://localhost/db"
def get_settings():
    return {"db": DATABASE_URL}
PYEOF

# Re-scan
echo '{"session_context":{"working_directory":"/tmp/ar-place-test"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-place-test-data node scripts/scan-project.mjs

echo '{"tool_input":{"file_path":"/tmp/ar-place-test/config/settings.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-place-test-data node scripts/validate-placement.mjs
echo "Exit: $?"
```

- [ ] Exits 0 (config module has no forbidden list)

---

## Phase 2: False Positive / False Negative Hunting

These tests specifically target known weaknesses in the heuristics.

### 2.1 Comment detection edge cases

```python
# Create a file with tricky comment-like patterns
cat > /tmp/ar-fp-comments.py << 'PYEOF'
url = "https://example.com#section"
color = "#FF0000"
channel = "C#"
regex = r"#\d+"
markdown = "Use ## for headings"
sql = "SELECT * FROM users WHERE id = 1  -- this is SQL, not Python"
PYEOF
```

- [ ] `#` inside strings should NOT be flagged (are they?)
- [ ] This is a known limitation of regex-based checking — document if unfixable

### 2.2 Function classification edge cases

```python
# Functions whose names match helper patterns but are legitimate route handlers
cat > /tmp/ar-place-test/routers/auth.py << 'PYEOF'
from fastapi import APIRouter
router = APIRouter()

@router.post("/validate-token")
async def validate_token(token: str):
    return {"valid": True}

@router.get("/format-response/{id}")
async def format_response(id: int):
    return {"formatted": True}
PYEOF
```

- [ ] `validate_token` should NOT be flagged (has route decorator)
- [ ] `format_response` should NOT be flagged (has route decorator)
- [ ] If they ARE flagged, the decorator detection range (3 lines) may be too small

### 2.3 Deeply nested directories

```bash
mkdir -p /tmp/ar-deep/src/app/api/v2/routers
cat > /tmp/ar-deep/src/app/api/v2/routers/items.py << 'PYEOF'
def helper_function():
    pass
PYEOF

echo '{"session_context":{"working_directory":"/tmp/ar-deep"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-deep-data node scripts/scan-project.mjs

cat /tmp/ar-deep-data/arch-map.json | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Modules:', Object.keys(j.modules));
"
```

- [ ] Does `src/app/api/v2/routers/` get discovered? (Expected: NO — scanner only goes 1 level deep)
- [ ] Document this as a known limitation that needs `.agent-runway.yml` config

### 2.4 Non-Python route frameworks

```bash
# Express.js routes
mkdir -p /tmp/ar-express/routes
cat > /tmp/ar-express/routes/users.js << 'JSEOF'
const express = require('express');
const router = express.Router();

function formatUserData(user) {
  return { id: user.id, name: user.name };
}

router.get('/users', (req, res) => {
  res.json([]);
});

module.exports = router;
JSEOF

echo '{"session_context":{"working_directory":"/tmp/ar-express"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-express-data node scripts/scan-project.mjs

echo '{"tool_input":{"file_path":"/tmp/ar-express/routes/users.js"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-express-data node scripts/validate-placement.mjs 2>&1
echo "Exit: $?"
```

- [ ] Does `formatUserData` get flagged as a helper in a router file?
- [ ] Does the Express route pattern detection work?

---

## Phase 3: .agent-runway.yml Config Testing

### 3.1 Valid config

```bash
cat > /tmp/ar-config-test/.agent-runway.yml << 'EOF'
modules:
  src/:
    purpose: "Main source code"
    forbidden:
      - "test functions"

conventions:
  no_inline_comments:
    enabled: true
    enforcement: block
  no_noqa:
    enabled: false
  custom:
    - pattern: "TODO"
      message: "TODO marker found"
      enforcement: warn

ignore:
  - "*.test.js"

context:
  max_size: 1500
  extra_instructions: "Use TypeScript strict mode."
EOF

mkdir -p /tmp/ar-config-test/src
echo '{"session_context":{"working_directory":"/tmp/ar-config-test"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-config-data node scripts/scan-project.mjs

cat /tmp/ar-config-data/arch-map.json | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('no_inline_comments enforcement:', j.conventions.no_inline_comments.enforcement);
  console.log('no_noqa enabled:', j.conventions.no_noqa.enabled);
  console.log('context max_size:', j.context.max_size);
  console.log('custom rules:', j.conventions.custom?.length);
  console.log('context_block length:', j.context_block.length);
"
```

- [ ] `no_inline_comments` enforcement is `block` (overridden from default `warn`)
- [ ] `no_noqa` is disabled
- [ ] `max_size` is 1500
- [ ] Custom rules count is 1
- [ ] Context block is under 1500 chars

### 3.2 Invalid / malformed config

```bash
# Typo in field name
cat > /tmp/ar-bad-config/.agent-runway.yml << 'EOF'
conventionz:
  no_inline_comments:
    enabled: true
    enforcment: blok
EOF

mkdir -p /tmp/ar-bad-config
echo '{"session_context":{"working_directory":"/tmp/ar-bad-config"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-bad-data node scripts/scan-project.mjs 2>&1
echo "Exit: $?"
```

- [ ] Does not crash
- [ ] Does it silently ignore the typo? (Expected: YES — this is a problem, should warn)
- [ ] Log this as an issue: config validation is missing

```bash
# Completely invalid YAML
echo "{{{{not yaml" > /tmp/ar-bad-yaml/.agent-runway.yml
mkdir -p /tmp/ar-bad-yaml
echo '{"session_context":{"working_directory":"/tmp/ar-bad-yaml"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-bad-yaml-data node scripts/scan-project.mjs 2>&1
echo "Exit: $?"
```

- [ ] Does not crash
- [ ] Falls back to defaults

```bash
# Invalid regex in custom rule
cat > /tmp/ar-bad-regex/.agent-runway.yml << 'EOF'
conventions:
  custom:
    - pattern: "[invalid(regex"
      message: "Bad pattern"
      enforcement: warn
EOF

mkdir -p /tmp/ar-bad-regex
echo '{"session_context":{"working_directory":"/tmp/ar-bad-regex"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-bad-regex-data node scripts/scan-project.mjs

cat > /tmp/ar-bad-regex/test.py << 'EOF'
x = 1
EOF

echo '{"tool_input":{"file_path":"/tmp/ar-bad-regex/test.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-bad-regex-data node scripts/validate-conventions.mjs 2>&1
echo "Exit: $?"
```

- [ ] Does the invalid regex crash the validator?
- [ ] If yes, this is a critical bug — must catch regex compilation errors

---

## Phase 4: Cross-platform and Robustness

### 4.1 Path handling

```bash
# File path with spaces
mkdir -p "/tmp/ar spaces test/routers"
cat > "/tmp/ar spaces test/routers/main.py" << 'PYEOF'
def helper():
    pass
PYEOF

echo '{"session_context":{"working_directory":"/tmp/ar spaces test"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-spaces-data node scripts/scan-project.mjs

echo '{"tool_input":{"file_path":"/tmp/ar spaces test/routers/main.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-spaces-data node scripts/validate-placement.mjs 2>&1
echo "Exit: $?"
```

- [ ] Handles spaces in paths correctly

### 4.2 Large projects

```bash
# Create a project with many directories
mkdir -p /tmp/ar-large
for i in $(seq 1 50); do
  mkdir -p "/tmp/ar-large/module_$i"
  echo "def func_$i(): pass" > "/tmp/ar-large/module_$i/main.py"
done

echo '{"session_context":{"working_directory":"/tmp/ar-large"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-large-data timeout 10 node scripts/scan-project.mjs
echo "Exit: $?"
```

- [ ] Completes within the 30-second hook timeout
- [ ] Context block stays under max_size despite 50 modules

### 4.3 Symlinks

```bash
mkdir -p /tmp/ar-symlink/real_module
echo "def helper(): pass" > /tmp/ar-symlink/real_module/main.py
ln -s /tmp/ar-symlink/real_module /tmp/ar-symlink/linked_module

echo '{"session_context":{"working_directory":"/tmp/ar-symlink"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-symlink-data node scripts/scan-project.mjs

cat /tmp/ar-symlink-data/arch-map.json | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Modules:', Object.keys(j.modules));
"
```

- [ ] Does not crash on symlinks
- [ ] Does not create infinite loops on circular symlinks

### 4.4 Binary files in code directories

```bash
mkdir -p /tmp/ar-binary/src
echo "def clean(): pass" > /tmp/ar-binary/src/main.py
dd if=/dev/urandom of=/tmp/ar-binary/src/data.bin bs=1024 count=1 2>/dev/null

echo '{"session_context":{"working_directory":"/tmp/ar-binary"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-binary-data node scripts/scan-project.mjs
echo "Exit: $?"
```

- [ ] Binary files don't crash the scanner
- [ ] Binary files are skipped (not code extension)

### 4.5 Permission denied

```bash
mkdir -p /tmp/ar-perm/secret
chmod 000 /tmp/ar-perm/secret

echo '{"session_context":{"working_directory":"/tmp/ar-perm"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/ar-perm-data node scripts/scan-project.mjs
echo "Exit: $?"

chmod 755 /tmp/ar-perm/secret
```

- [ ] Does not crash on permission denied
- [ ] Skips unreadable directories

---

## Phase 5: Fix Everything

After completing Phases 1-4, compile a complete issues list organized by severity:

### Critical (must fix before v1.0)
- Crashes, data loss, silent failures that hide real problems

### Major (should fix before v1.0)
- False positives that would frustrate users
- Missing validation that lets bad config through silently
- Cross-platform issues

### Minor (can fix in v1.1)
- Cosmetic issues, documentation gaps, minor heuristic improvements

Then fix every critical and major issue. For each fix:
1. Write the fix
2. Re-run the test that found the issue
3. Verify the fix doesn't break other tests

After fixing, re-run ALL tests from Phases 1-4 as a regression suite.

---

## Phase 6: Write Automated Tests

After all fixes are stable, convert the manual tests above into an automated test suite:

- Create `tests/` directory
- Use Node.js built-in `node:test` and `node:assert` (no test framework dependency)
- One test file per script: `test-scan.mjs`, `test-inject.mjs`, `test-conventions.mjs`, `test-placement.mjs`
- One test file for config: `test-config.mjs`
- Add `"test": "node --test tests/"` to `package.json`
- Every edge case from Phases 1-4 should become a test case

---

## Cleanup

After all phases:

```bash
rm -rf /tmp/ar-test /tmp/ar-test2 /tmp/ar-test-empty /tmp/ar-test-nodir \
  /tmp/ar-test-noinput /tmp/ar-test-badjson /tmp/ar-conv-test.py \
  /tmp/ar-conv-test.ts /tmp/ar-place-test /tmp/ar-place-test-data \
  /tmp/ar-deep /tmp/ar-deep-data /tmp/ar-express /tmp/ar-express-data \
  /tmp/ar-config-test /tmp/ar-config-data /tmp/ar-bad-config /tmp/ar-bad-data \
  /tmp/ar-bad-yaml /tmp/ar-bad-yaml-data /tmp/ar-bad-regex /tmp/ar-bad-regex-data \
  "/tmp/ar spaces test" /tmp/ar-spaces-data /tmp/ar-large /tmp/ar-large-data \
  /tmp/ar-symlink /tmp/ar-symlink-data /tmp/ar-binary /tmp/ar-binary-data \
  /tmp/ar-perm /tmp/ar-perm-data /tmp/ar-fp-comments.py /tmp/agent-runway
```
