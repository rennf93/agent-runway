import { readFileSync, existsSync } from "fs";
import { readStdin, respond, getPluginDataDir } from "./lib/io.mjs";

const CONTEXT_HEADER = "=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===";
const CONTEXT_FOOTER = "=== END ARCHITECTURAL CONTEXT ===";

async function main() {
  const input = await readStdin();
  const toolInput = input.tool_input;

  if (!toolInput?.prompt) {
    process.exit(0);
  }

  const dataDir = getPluginDataDir();
  const archMapPath = `${dataDir}/arch-map.json`;

  if (!existsSync(archMapPath)) {
    process.exit(0);
  }

  let archMap;
  try {
    archMap = JSON.parse(readFileSync(archMapPath, "utf8"));
  } catch {
    process.exit(0);
  }

  if (!archMap.context_block) {
    process.exit(0);
  }

  if (toolInput.prompt.includes(CONTEXT_HEADER)) {
    process.exit(0);
  }

  const augmentedPrompt = [
    CONTEXT_HEADER,
    "",
    archMap.context_block,
    "",
    CONTEXT_FOOTER,
    "",
    toolInput.prompt,
  ].join("\n");

  const updatedInput = { ...toolInput, prompt: augmentedPrompt };

  respond({
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    updatedInput,
  });
}

main().catch((err) => {
  process.stderr.write(`[Agent Runway] Inject error: ${err.message}\n`);
  process.exit(0);
});
