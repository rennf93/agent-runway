---
name: runway-status
description: Check the current Agent Runway status - loaded architectural map, active conventions, module boundaries, and enforcement levels. Use when debugging agent behavior or verifying plugin configuration.
---

# Runway Status

Read and display the current Agent Runway architectural map to understand what context is being injected into subagents.

## Steps

1. Read the arch-map.json from the plugin data directory:
   - Path: `${CLAUDE_PLUGIN_DATA}/arch-map.json` (or check `/tmp/agent-runway/arch-map.json` as fallback)

2. Display a summary:
   - Project name and scan timestamp
   - Module boundaries with their purposes and forbidden definitions
   - Active conventions with enforcement levels (warn/block)
   - CLAUDE.md rules that were extracted
   - Context block size (characters)

3. If `.agent-runway.yml` exists in the working directory, also display:
   - User-configured overrides
   - Custom convention rules
   - Extra instructions

4. If the arch-map.json does not exist, inform the user that the plugin has not scanned the project yet (happens on SessionStart).
