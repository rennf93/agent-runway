import { tmpdir } from "os";
import { join } from "path";

export function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", reject);
  });
}

export function respond(hookSpecificOutput) {
  const output = { hookSpecificOutput };
  process.stdout.write(JSON.stringify(output) + "\n");
}

export function allow(updatedInput, additionalContext) {
  const output = { permissionDecision: "allow" };
  if (updatedInput) output.updatedInput = updatedInput;
  if (additionalContext) output.additionalContext = additionalContext;
  respond(output);
}

export function block(reason) {
  process.stderr.write(reason + "\n");
  process.exit(2);
}

export function warn(message) {
  respond({ additionalContext: message });
}

export function getWorkingDirectory(input) {
  return (
    input?.session_context?.working_directory ||
    input?.working_directory ||
    process.cwd()
  );
}

export function getPluginDataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), "agent-runway");
}

export function getPluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || new URL("../../", import.meta.url).pathname;
}
