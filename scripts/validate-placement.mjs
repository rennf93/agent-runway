import { readFileSync, existsSync } from "fs";
import { readStdin, respond, block, getPluginDataDir } from "./lib/io.mjs";
import { isCodeFile, shouldIgnoreFile } from "./lib/config.mjs";
import { getModuleForFile, isRouterDirectory } from "./lib/scanner.mjs";

const PYTHON_FUNC_RE = /^(?:async\s+)?def\s+(\w+)\s*\(/;
const PYTHON_CLASS_RE = /^class\s+(\w+)/;
const JS_FUNC_RE = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const JS_CLASS_RE = /^(?:export\s+)?class\s+(\w+)/;
const JS_ARROW_RE = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/;

const ROUTE_DECORATOR_PATTERNS = [
  /@(?:app|router|blueprint)\.\s*(?:get|post|put|patch|delete|head|options|route)\s*\(/,
  /@(?:api_view|action|require_http_methods)/,
  /app\.(?:get|post|put|patch|delete|all|use)\s*\(/,
  /router\.(?:get|post|put|patch|delete|all|use)\s*\(/,
  /\.(Get|Post|Put|Patch|Delete|Head|Options)\s*\(/,
];

const HELPER_PATTERNS = /^(helper|util|format|parse|convert|transform|sanitize|normalize|extract)_|_(helper|util|utility|formatter|parser|converter)$/i;
const BUSINESS_LOGIC_PATTERNS = /service|manager|handler|processor|orchestrat|pipeline|workflow|engine/i;
const MODEL_PATTERNS = /model|schema|entity|dto|dataclass|basemodel|serializer/i;
const TEST_PATTERNS = /^test_|_test$|\.test\.|\.spec\./;

async function main() {
  const input = await readStdin();
  const filePath = input.tool_input?.file_path;

  if (!filePath) process.exit(0);
  if (!isCodeFile(filePath)) process.exit(0);

  const dataDir = getPluginDataDir();
  const archMapPath = `${dataDir}/arch-map.json`;

  let archMap;
  try {
    archMap = JSON.parse(readFileSync(archMapPath, "utf8"));
  } catch {
    process.exit(0);
  }

  if (shouldIgnoreFile(filePath, archMap.ignore || [])) process.exit(0);

  const moduleInfo = getModuleForFile(filePath, archMap.working_directory, archMap.modules || {});
  if (!moduleInfo || !moduleInfo.forbidden || moduleInfo.forbidden.length === 0) {
    process.exit(0);
  }

  let fileContent;
  try {
    fileContent = readFileSync(filePath, "utf8");
  } catch {
    process.exit(0);
  }

  const lines = fileContent.split("\n");
  const definitions = extractDefinitions(lines);
  const routeDecorators = findRouteDecorators(lines);
  const isRouter = isRouterDirectory(filePath, archMap.modules || {});
  const violations = [];

  for (const def of definitions) {
    if (isRouter && def.kind === "function") {
      const hasDecorator = routeDecorators.some(
        (decoratorLine) => decoratorLine < def.line && def.line - decoratorLine <= 3
      );
      if (hasDecorator) continue;
    }

    const defType = classifyDefinition(def.name, def.kind);
    for (const forbidden of moduleInfo.forbidden) {
      if (matchesForbidden(defType, forbidden)) {
        violations.push({
          line: def.line,
          content: `"${def.name}" (${defType}) is forbidden in ${moduleInfo.path} (${moduleInfo.purpose}). Forbidden: ${forbidden}.`,
        });
      }
    }
  }

  if (violations.length === 0) process.exit(0);

  const enforcement = archMap.conventions?.no_helpers_in_routers?.enforcement || "warn";

  if (enforcement === "block") {
    const formatted = violations.map((v) => `  L${v.line}: ${v.content}`).join("\n");
    block(`[Agent Runway] BLOCKING - Module boundary violations in ${filePath} (${moduleInfo.path}):\n${formatted}`);
  } else {
    const parts = [
      `[Agent Runway] You placed code in the wrong module (${filePath}, part of ${moduleInfo.path}: ${moduleInfo.purpose}). Fix these before moving on:`,
    ];
    for (const v of violations) {
      parts.push(`  - L${v.line}: Move "${v.content.split('"')[1]}" to the appropriate module (services/, helpers/, etc.)`);
    }
    parts.push(`Edit or move the code to the correct module, then continue with your task.`);
    respond({
      hookEventName: "PostToolUse",
      additionalContext: parts.join("\n"),
    });
  }
}

function extractDefinitions(lines) {
  const defs = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    let match;

    match = PYTHON_FUNC_RE.exec(trimmed);
    if (match) {
      defs.push({ name: match[1], kind: "function", line: i + 1 });
      continue;
    }

    match = PYTHON_CLASS_RE.exec(trimmed);
    if (match) {
      defs.push({ name: match[1], kind: "class", line: i + 1 });
      continue;
    }

    match = JS_FUNC_RE.exec(trimmed);
    if (match) {
      defs.push({ name: match[1], kind: "function", line: i + 1 });
      continue;
    }

    match = JS_CLASS_RE.exec(trimmed);
    if (match) {
      defs.push({ name: match[1], kind: "class", line: i + 1 });
      continue;
    }

    match = JS_ARROW_RE.exec(trimmed);
    if (match) {
      defs.push({ name: match[1], kind: "function", line: i + 1 });
    }
  }
  return defs;
}

function classifyDefinition(name, kind) {
  if (TEST_PATTERNS.test(name)) return "test functions";
  if (kind === "class") {
    if (MODEL_PATTERNS.test(name)) return "data models";
    if (BUSINESS_LOGIC_PATTERNS.test(name)) return "business logic";
    return "class definitions";
  }
  if (MODEL_PATTERNS.test(name)) return "data models";
  if (BUSINESS_LOGIC_PATTERNS.test(name)) return "business logic";
  if (HELPER_PATTERNS.test(name)) return "helper functions";
  return "functions";
}

function findRouteDecorators(lines) {
  const decorators = [];
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of ROUTE_DECORATOR_PATTERNS) {
      if (pattern.test(lines[i])) {
        decorators.push(i + 1);
        break;
      }
    }
  }
  return decorators;
}

function matchesForbidden(defType, forbidden) {
  const normalizedForbidden = forbidden.toLowerCase();
  const normalizedType = defType.toLowerCase();

  if (normalizedType === normalizedForbidden) return true;
  if (normalizedForbidden.includes("helper") && normalizedType.includes("helper")) return true;
  if (normalizedForbidden.includes("business") && normalizedType.includes("business")) return true;
  if (normalizedForbidden.includes("model") && normalizedType.includes("model")) return true;
  if (normalizedForbidden.includes("utility") && (normalizedType.includes("utility") || normalizedType.includes("helper"))) return true;
  if (normalizedForbidden.includes("test") && normalizedType.includes("test")) return true;
  if (normalizedForbidden.includes("production") && !normalizedType.includes("test")) return true;

  return false;
}

main().catch((err) => {
  process.stderr.write(`[Agent Runway] Placement error: ${err.message}\n`);
  process.exit(0);
});
