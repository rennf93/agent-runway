import { mkdirSync, writeFileSync } from "fs";
import { readStdin, respond, getWorkingDirectory, getPluginDataDir } from "./lib/io.mjs";
import { loadConfig, validateConfig } from "./lib/config.mjs";
import { scanProject, extractClaudeMdRules } from "./lib/scanner.mjs";

async function main() {
  const input = await readStdin();
  const workDir = getWorkingDirectory(input);
  const dataDir = getPluginDataDir();

  mkdirSync(dataDir, { recursive: true });

  const config = loadConfig(workDir);
  const configWarnings = validateConfig(workDir);
  const { projectName, modules: discoveredModules } = scanProject(workDir);

  const mergedModules = { ...discoveredModules };
  for (const [path, userDef] of Object.entries(config.modules)) {
    const normalizedPath = path.endsWith("/") ? path : path + "/";
    mergedModules[normalizedPath] = {
      ...mergedModules[normalizedPath],
      ...userDef,
      purpose: userDef.purpose || mergedModules[normalizedPath]?.purpose || "User-defined module",
    };
  }

  const claudeMdRules = extractClaudeMdRules(workDir);
  const contextBlock = buildContextBlock(projectName, mergedModules, config.conventions, claudeMdRules, config.context);

  const archMap = {
    project_name: projectName,
    working_directory: workDir,
    scanned_at: new Date().toISOString(),
    modules: mergedModules,
    conventions: config.conventions,
    claude_md_rules: claudeMdRules,
    ignore: config.ignore,
    context: config.context,
    context_block: contextBlock,
  };

  writeFileSync(`${dataDir}/arch-map.json`, JSON.stringify(archMap, null, 2));

  const moduleCount = Object.keys(mergedModules).length;
  const ruleCount = claudeMdRules.length;
  const conventionCount = Object.entries(config.conventions)
    .filter(([k, v]) => k !== "custom" && v.enabled).length + (config.conventions.custom?.length || 0);

  let summary = `[Agent Runway] Project "${projectName}" scanned: ${moduleCount} modules, ${conventionCount} conventions, ${ruleCount} CLAUDE.md rules loaded. Subagent prompts will be augmented with architectural context automatically.`;
  if (configWarnings.length > 0) {
    summary += `\n[Agent Runway] Config warnings:\n${configWarnings.map((w) => `  - ${w}`).join("\n")}`;
  }

  respond({
    hookEventName: "SessionStart",
    additionalContext: summary,
  });
}

function buildContextBlock(projectName, modules, conventions, claudeMdRules, contextConfig) {
  const parts = [];

  parts.push(`Project: ${projectName}`);
  parts.push("");
  parts.push("Module Boundaries:");
  for (const [path, info] of Object.entries(modules)) {
    let line = `- ${path} -> ${info.purpose}`;
    if (info.forbidden?.length > 0) {
      line += `. NO: ${info.forbidden.join(", ")}`;
    }
    parts.push(line);
  }

  parts.push("");
  parts.push("Mandatory Conventions:");
  for (const [key, value] of Object.entries(conventions)) {
    if (key === "custom") continue;
    if (!value.enabled) continue;
    const label = key.replace(/_/g, " ").replace(/^no /, "NO ");
    parts.push(`- ${label.toUpperCase()} [${value.enforcement}]`);
  }
  if (conventions.custom?.length > 0) {
    for (const rule of conventions.custom) {
      parts.push(`- ${rule.message} [${rule.enforcement}]`);
    }
  }

  if (claudeMdRules.length > 0) {
    parts.push("");
    parts.push("CLAUDE.md Rules (MANDATORY):");
    for (const rule of claudeMdRules) {
      parts.push(`- ${rule}`);
    }
  }

  if (contextConfig.extra_instructions) {
    parts.push("");
    parts.push("Additional Instructions:");
    parts.push(contextConfig.extra_instructions.trim());
  }

  let block = parts.join("\n");
  if (block.length > contextConfig.max_size) {
    block = block.slice(0, contextConfig.max_size - 20) + "\n[...truncated]";
  }

  return block;
}

main().catch((err) => {
  process.stderr.write(`[Agent Runway] Scan error: ${err.message}\n`);
  process.exit(0);
});
