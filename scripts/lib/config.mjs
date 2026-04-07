import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

const DEFAULT_CONVENTIONS = {
  no_inline_comments: { enabled: true, enforcement: "warn" },
  no_lint_suppressions: { enabled: true, enforcement: "warn" },
  no_noqa: { enabled: true, enforcement: "warn" },
  no_type_ignore: { enabled: true, enforcement: "warn" },
  no_helpers_in_routers: { enabled: true, enforcement: "warn" },
  custom: [],
};

const DEFAULT_CONTEXT = {
  max_size: 3000,
  include_claude_md: "summary",
  extra_instructions: "",
};

const DEFAULT_IGNORE = [
  "*.md",
  "*.yml",
  "*.yaml",
  "*.json",
  "*.toml",
  "*.lock",
  "*.txt",
  "*.csv",
  "*.svg",
  "*.png",
  "*.jpg",
  "*.gif",
  "*.ico",
  "docs/",
  ".git/",
  "node_modules/",
  "__pycache__/",
  ".venv/",
  "venv/",
];

const CODE_EXTENSIONS = new Set([
  ".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".go", ".rs", ".java", ".kt", ".scala", ".rb",
  ".php", ".swift", ".c", ".cpp", ".h", ".hpp",
  ".cs", ".lua", ".sh", ".bash", ".zsh",
]);

export function isCodeFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return CODE_EXTENSIONS.has(ext);
}

export function loadConfig(workingDirectory) {
  const configPath = join(workingDirectory, ".agent-runway.yml");
  let userConfig = {};

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf8");
      userConfig = yaml.load(raw) || {};
    } catch {
      userConfig = {};
    }
  }

  const conventions = { ...DEFAULT_CONVENTIONS };
  if (userConfig.conventions) {
    for (const [key, value] of Object.entries(userConfig.conventions)) {
      if (key === "custom") {
        conventions.custom = value || [];
      } else if (typeof value === "object" && value !== null) {
        conventions[key] = { ...DEFAULT_CONVENTIONS[key], ...value };
      }
    }
  }

  const context = { ...DEFAULT_CONTEXT, ...(userConfig.context || {}) };
  const ignore = userConfig.ignore || DEFAULT_IGNORE;
  const modules = userConfig.modules || {};

  return { modules, conventions, context, ignore };
}

const VALID_TOP_LEVEL_KEYS = new Set(["modules", "conventions", "context", "ignore"]);
const VALID_CONVENTION_KEYS = new Set([
  "no_inline_comments", "no_lint_suppressions", "no_noqa",
  "no_type_ignore", "no_helpers_in_routers", "custom",
]);
const VALID_ENFORCEMENT_VALUES = new Set(["warn", "block"]);

export function validateConfig(workingDirectory) {
  const configPath = join(workingDirectory, ".agent-runway.yml");
  const warnings = [];

  if (!existsSync(configPath)) return warnings;

  let userConfig;
  try {
    const raw = readFileSync(configPath, "utf8");
    userConfig = yaml.load(raw) || {};
  } catch {
    warnings.push("Failed to parse .agent-runway.yml");
    return warnings;
  }

  for (const key of Object.keys(userConfig)) {
    if (!VALID_TOP_LEVEL_KEYS.has(key)) {
      warnings.push(`Unknown top-level key "${key}" in .agent-runway.yml (valid: ${[...VALID_TOP_LEVEL_KEYS].join(", ")})`);
    }
  }

  if (userConfig.conventions && typeof userConfig.conventions === "object") {
    for (const [key, value] of Object.entries(userConfig.conventions)) {
      if (!VALID_CONVENTION_KEYS.has(key)) {
        warnings.push(`Unknown convention "${key}" in .agent-runway.yml (valid: ${[...VALID_CONVENTION_KEYS].join(", ")})`);
        continue;
      }

      if (key === "custom") continue;

      if (typeof value === "object" && value !== null) {
        if ("enforcement" in value && !VALID_ENFORCEMENT_VALUES.has(value.enforcement)) {
          warnings.push(`Invalid enforcement "${value.enforcement}" for convention "${key}" (valid: warn, block)`);
        }
        if ("enabled" in value && typeof value.enabled !== "boolean") {
          warnings.push(`Invalid enabled value for convention "${key}" — expected boolean, got ${typeof value.enabled}`);
        }
      }
    }
  }

  return warnings;
}

export function shouldIgnoreFile(filePath, ignorePatterns) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const pattern of ignorePatterns) {
    if (pattern.endsWith("/") && normalized.includes(pattern)) return true;
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (normalized.endsWith(ext)) return true;
    }
    if (normalized.endsWith(pattern)) return true;
  }
  return false;
}
