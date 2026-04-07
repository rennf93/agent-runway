# Testing Agent Runway

## Prerequisites

- Claude Code CLI installed and working
- Node.js >= 18
- A project to test against (e.g., fastapi-guard)

## 1. Install Dependencies

```bash
cd /path/to/claude-agent-runway
npm install
```

## 2. Validate Plugin Structure

```bash
claude plugin validate /path/to/claude-agent-runway
```

This checks the `.claude-plugin/plugin.json` manifest is well-formed.

## 3. Run Plugin in a Session

### Option A: Session-only (recommended for development)

```bash
cd /path/to/your-project
claude --plugin-dir /path/to/claude-agent-runway
```

### Option B: With debug logging (see hook execution)

```bash
cd /path/to/your-project
claude --plugin-dir /path/to/claude-agent-runway -d "hooks"
```

### Option C: Debug to file (review later)

```bash
cd /path/to/your-project
claude --plugin-dir /path/to/claude-agent-runway --debug-file /tmp/runway-debug.log
```

## 4. Verify SessionStart Hook

When the session starts, you should see the plugin's context message:

```
[Agent Runway] Project "fastapi-guard" scanned: X modules, Y conventions, Z CLAUDE.md rules loaded.
```

If you don't see it, check the debug output for errors.

### Manual test (outside Claude):

```bash
cd /path/to/claude-agent-runway
echo '{"session_context":{"working_directory":"/path/to/your-project"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-test node scripts/scan-project.mjs
```

Then inspect the generated map:

```bash
cat /tmp/agent-runway-test/arch-map.json | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Project:', j.project_name);
  console.log('Modules:', Object.keys(j.modules).join(', '));
  console.log('Rules:', j.claude_md_rules.length);
  console.log('Context block length:', j.context_block.length, 'chars');
"
```

## 5. Test PreToolUse Context Injection

### Inside a Claude session:

Ask Claude to delegate work to a subagent:

```
Delegate to an agent: read guard/middleware.py and list all method names
```

With debug logging enabled (`-d "hooks"`), you should see:
- PreToolUse hook firing for the Agent tool
- The `updatedInput` containing the architectural context prepended to the prompt

### Manual test (outside Claude):

```bash
cd /path/to/claude-agent-runway
echo '{"tool_input":{"prompt":"Refactor the middleware to reduce complexity","subagent_type":"general-purpose"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-test node scripts/inject-context.mjs
```

The output should show `updatedInput.prompt` starting with `=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===`.

## 6. Test PostToolUse Convention Validation

### Inside a Claude session:

Ask Claude (or a subagent) to write code with violations:

```
Create a file at /tmp/test-violation.py with this content:
# This is a comment that should be caught
def helper_format_data(x):  # noqa
    return x  # type: ignore
```

The convention validator should report violations for:
- Inline comment on line 1
- `# noqa` suppression
- `# type: ignore` suppression

### Manual test (outside Claude):

First, create a test file:

```bash
cat > /tmp/test-violation.py << 'EOF'
# This is a comment
def format_data(x):  # noqa
    return str(x)  # type: ignore
EOF
```

Then run the validator:

```bash
cd /path/to/claude-agent-runway
echo '{"tool_input":{"file_path":"/tmp/test-violation.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-test node scripts/validate-conventions.mjs 2>&1
echo "Exit code: $?"
```

Expected: violations reported (exit 0 for warn mode, exit 2 for block mode).

## 7. Test PostToolUse Placement Validation

### Manual test:

Create a file that simulates a helper function in a router directory:

```bash
mkdir -p /tmp/test-project/routers
cat > /tmp/test-project/routers/users.py << 'EOF'
from fastapi import APIRouter

router = APIRouter()

def format_user_response(user):
    return {"id": user.id, "name": user.name}

def validate_user_input(data):
    if not data.get("name"):
        raise ValueError("name required")

@router.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"user_id": user_id}
EOF
```

First, scan the test project:

```bash
cd /path/to/claude-agent-runway
echo '{"session_context":{"working_directory":"/tmp/test-project"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-placement node scripts/scan-project.mjs
```

Then run placement validation:

```bash
echo '{"tool_input":{"file_path":"/tmp/test-project/routers/users.py"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-placement node scripts/validate-placement.mjs 2>&1
echo "Exit code: $?"
```

Expected: violations for `format_user_response` and `validate_user_input` being non-route functions in a router file.

## 8. Test with .agent-runway.yml Configuration

Create a config in the fastapi-guard project:

```bash
cat > /path/to/your-project/.agent-runway.yml << 'EOF'
modules:
  guard/:
    purpose: "Adapter package over guard-core - only middleware and adapters"
    allowed:
      - "middleware classes"
      - "adapter classes"
      - "protocol adapters"
    forbidden:
      - "helper functions"
      - "business logic"
      - "data models"
  tests/:
    purpose: "Test suite"
    forbidden:
      - "production code"

conventions:
  no_inline_comments:
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
      enforcement: warn

context:
  max_size: 3000
  include_claude_md: summary
  extra_instructions: |
    This project uses uv for package management.
    Run tests with: REDIS_URL=redis://localhost:6379 uv run pytest
EOF
```

Then re-run the scanner and verify the config overrides are applied:

```bash
cd /path/to/claude-agent-runway
echo '{"session_context":{"working_directory":"/path/to/your-project"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/agent-runway-config node scripts/scan-project.mjs

# Check enforcement levels changed from defaults
cat /tmp/agent-runway-config/arch-map.json | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('no_inline_comments:', j.conventions.no_inline_comments.enforcement);
  console.log('no_noqa:', j.conventions.no_noqa.enforcement);
  console.log('no_type_ignore:', j.conventions.no_type_ignore.enforcement);
  console.log('guard/ forbidden:', j.modules['guard/']?.forbidden);
  console.log('Custom rules:', j.conventions.custom?.length);
"
```

Expected output:

```
no_inline_comments: block
no_noqa: block
no_type_ignore: warn
guard/ forbidden: [ 'helper functions', 'business logic', 'data models' ]
Custom rules: 2
```

## 9. End-to-End Integration Test

This is the real test. In a Claude Code session with the plugin loaded:

```bash
cd /path/to/your-project
claude --plugin-dir /path/to/claude-agent-runway --debug-file /tmp/runway-e2e.log
```

Then inside the session, try these prompts:

### Test 1: Verify context injection

```
Use an agent to read guard/middleware.py and summarize what SecurityMiddleware does.
```

After the agent runs, check the debug log:

```bash
grep "AGENT RUNWAY" /tmp/runway-e2e.log
```

You should see the architectural context being injected.

### Test 2: Trigger a convention violation

```
Use an agent to add a comment explaining what each import does in guard/__init__.py
```

The convention validator should catch the comments and warn/block.

### Test 3: Trigger a placement violation

```
Use an agent to create a helper function called format_ip_address in guard/middleware.py
```

The placement validator should flag this as a helper in the wrong module.

### Test 4: Check runway status skill

```
/agent-runway:runway-status
```

Should display the current architectural map.

## 10. Permanent Installation

Once testing passes, install permanently:

```bash
# User-level (available in all projects)
claude plugin install agent-runway --path /path/to/claude-agent-runway -s user

# Or project-level (only for fastapi-guard)
cd /path/to/your-project
claude plugin install agent-runway --path /path/to/claude-agent-runway -s project
```

## Troubleshooting

### Plugin not loading

```bash
# Check plugin is recognized
claude plugin validate /path/to/claude-agent-runway

# Check debug output
claude --plugin-dir /path/to/claude-agent-runway -d "hooks"
```

### Hooks not firing

1. Verify hooks.json is valid JSON:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('/path/to/claude-agent-runway/hooks/hooks.json','utf8'));console.log('Valid')"
   ```

2. Check that scripts are executable and have no syntax errors:
   ```bash
   node --check /path/to/claude-agent-runway/scripts/scan-project.mjs
   node --check /path/to/claude-agent-runway/scripts/inject-context.mjs
   node --check /path/to/claude-agent-runway/scripts/validate-conventions.mjs
   node --check /path/to/claude-agent-runway/scripts/validate-placement.mjs
   ```

3. Check CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA are set:
   ```bash
   # In a session, ask Claude to run:
   echo $CLAUDE_PLUGIN_ROOT
   echo $CLAUDE_PLUGIN_DATA
   ```

### Convention validator false positives

The `no_inline_comments` rule may flag legitimate shebangs or encoding declarations. These are already filtered out, but if you see false positives:

1. Check the file extension is in the code extensions list (`.py`, `.js`, `.ts`, etc.)
2. Add the file pattern to the `ignore` list in `.agent-runway.yml`

### Arch-map not generated

If the scanner fails silently (it exits 0 on errors to avoid blocking sessions):

```bash
cd /path/to/claude-agent-runway
echo '{"session_context":{"working_directory":"/your/project"}}' \
  | CLAUDE_PLUGIN_DATA=/tmp/test node scripts/scan-project.mjs 2>&1
```

Check stderr for error messages.

## Cleanup

Remove test artifacts:

```bash
rm -rf /tmp/agent-runway-test /tmp/agent-runway-test2 /tmp/agent-runway-placement /tmp/agent-runway-config /tmp/test-violation.py /tmp/test-project /tmp/runway-debug.log /tmp/runway-e2e.log
```

Remove the .agent-runway.yml from fastapi-guard if it was just for testing:

```bash
rm /path/to/your-project/.agent-runway.yml
```
