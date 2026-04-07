import { spawn } from "child_process";
import { mkdirSync, readFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = join(__dirname, "..");
export const FIXTURES = join(__dirname, "fixtures");
export const SAMPLE_PROJECT = join(FIXTURES, "sample-project");

let tmpCounter = 0;

export function tmpDataDir() {
  const dir = join("/tmp", `ar-test-${process.pid}-${++tmpCounter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function runScript(scriptName, stdinJson, dataDir) {
  return new Promise((resolve) => {
    const scriptPath = join(PLUGIN_ROOT, "scripts", scriptName);
    const env = {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir || tmpDataDir(),
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    };

    const child = spawn("node", [scriptPath], { env, timeout: 15000 });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        json: parseJson(stdout),
      });
    });

    const input = typeof stdinJson === "string" ? stdinJson : JSON.stringify(stdinJson);
    child.stdin.write(input);
    child.stdin.end();
  });
}

export function scanProject(workingDirectory, dataDir) {
  return runScript("scan-project.mjs", {
    session_context: { working_directory: workingDirectory },
  }, dataDir);
}

export function injectContext(prompt, extraFields, dataDir) {
  return runScript("inject-context.mjs", {
    tool_input: { prompt, ...extraFields },
  }, dataDir);
}

export function validateConventions(filePath, dataDir) {
  return runScript("validate-conventions.mjs", {
    tool_input: { file_path: filePath },
  }, dataDir);
}

export function validatePlacement(filePath, dataDir) {
  return runScript("validate-placement.mjs", {
    tool_input: { file_path: filePath },
  }, dataDir);
}

function parseJson(str) {
  try {
    return JSON.parse(str.trim());
  } catch {
    return null;
  }
}

export function readArchMap(dataDir) {
  try {
    const content = readFileSync(join(dataDir, "arch-map.json"), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function cleanupTmpDirs() {
  for (let i = 1; i <= tmpCounter; i++) {
    const dir = join("/tmp", `ar-test-${process.pid}-${i}`);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}
