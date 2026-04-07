import { readFileSync, existsSync } from "fs";
import { readStdin, respond, block, getPluginDataDir, getWorkingDirectory } from "./lib/io.mjs";
import { isCodeFile, shouldIgnoreFile } from "./lib/config.mjs";
import { isRouterDirectory } from "./lib/scanner.mjs";
import {
  checkNoInlineComments,
  checkNoLintSuppressions,
  checkNoNoqa,
  checkNoTypeIgnore,
  checkNoHelpersInRouters,
  checkCustomPattern,
} from "./lib/rules.mjs";

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

  if (shouldIgnoreFile(filePath, archMap.ignore || [])) {
    process.exit(0);
  }

  let fileContent;
  try {
    fileContent = readFileSync(filePath, "utf8");
  } catch {
    process.exit(0);
  }

  const lines = fileContent.split("\n");
  const conventions = archMap.conventions || {};
  const blockingViolations = [];
  const warningViolations = [];

  function collect(ruleName, enforcement, violations) {
    if (violations.length === 0) return;
    const formatted = violations.map((v) => `  L${v.line}: ${v.content}`);
    const entry = { rule: ruleName, enforcement, details: formatted };
    if (enforcement === "block") {
      blockingViolations.push(entry);
    } else {
      warningViolations.push(entry);
    }
  }

  if (conventions.no_inline_comments?.enabled) {
    collect(
      "no_inline_comments",
      conventions.no_inline_comments.enforcement,
      checkNoInlineComments(lines, filePath)
    );
  }

  if (conventions.no_lint_suppressions?.enabled) {
    collect(
      "no_lint_suppressions",
      conventions.no_lint_suppressions.enforcement,
      checkNoLintSuppressions(lines, filePath)
    );
  }

  if (conventions.no_noqa?.enabled) {
    collect(
      "no_noqa",
      conventions.no_noqa.enforcement,
      checkNoNoqa(lines)
    );
  }

  if (conventions.no_type_ignore?.enabled) {
    collect(
      "no_type_ignore",
      conventions.no_type_ignore.enforcement,
      checkNoTypeIgnore(lines)
    );
  }

  if (conventions.no_helpers_in_routers?.enabled) {
    const isRouter = isRouterDirectory(filePath, archMap.modules || {});
    if (isRouter) {
      collect(
        "no_helpers_in_routers",
        conventions.no_helpers_in_routers.enforcement,
        checkNoHelpersInRouters(lines, filePath)
      );
    }
  }

  if (conventions.custom?.length > 0) {
    for (const rule of conventions.custom) {
      collect(
        `custom:${rule.message}`,
        rule.enforcement || "warn",
        checkCustomPattern(lines, rule.pattern, rule.message)
      );
    }
  }

  if (blockingViolations.length > 0) {
    const message = formatViolations(filePath, blockingViolations, "BLOCKING");
    block(message);
    return;
  }

  if (warningViolations.length > 0) {
    const message = formatViolations(filePath, warningViolations, "WARNING");
    respond({
      hookEventName: "PostToolUse",
      additionalContext: `[Agent Runway] Convention violations detected:\n${message}`,
    });
    return;
  }

  process.exit(0);
}

function formatViolations(filePath, violations, level) {
  const parts = [`[Agent Runway] ${level} - Convention violations in ${filePath}:`];
  for (const v of violations) {
    parts.push(`  Rule: ${v.rule} (${v.enforcement})`);
    for (const detail of v.details.slice(0, 5)) {
      parts.push(`    ${detail}`);
    }
    if (v.details.length > 5) {
      parts.push(`    ... and ${v.details.length - 5} more`);
    }
  }
  return parts.join("\n");
}

main().catch((err) => {
  process.stderr.write(`[Agent Runway] Validation error: ${err.message}\n`);
  process.exit(0);
});
