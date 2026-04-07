import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, basename, relative } from "path";
import { isCodeFile } from "./config.mjs";

const NON_CODE_DIRS = new Set([
  "docs", "doc", "site", "public", "static", "assets", "images",
  "dist", "build", "out", "coverage", ".github", ".vscode", ".idea",
]);

const KNOWN_MODULE_PURPOSES = {
  routers: "HTTP route/endpoint definitions",
  routes: "HTTP route/endpoint definitions",
  controllers: "HTTP request handlers",
  endpoints: "API endpoint definitions",
  views: "View/request handlers",
  services: "Business logic and orchestration",
  handlers: "Event/request handlers",
  helpers: "Shared utility/helper functions",
  utils: "Shared utility functions",
  utilities: "Shared utility functions",
  lib: "Shared library code",
  models: "Data models and schemas",
  schemas: "Data schemas and validation",
  types: "Type definitions",
  middleware: "Middleware components",
  adapters: "Adapter/integration layer",
  core: "Core application logic",
  config: "Configuration modules",
  settings: "Application settings",
  tests: "Test suite",
  test: "Test suite",
  specs: "Test specifications",
  fixtures: "Test fixtures and data",
  migrations: "Database migrations",
  scripts: "Utility scripts",
  commands: "CLI commands",
  tasks: "Background task definitions",
  workers: "Background workers",
  events: "Event definitions and handlers",
  exceptions: "Custom exception classes",
  errors: "Error handling",
  decorators: "Function/class decorators",
  protocols: "Interface/protocol definitions",
  plugins: "Plugin definitions",
  examples: "Example implementations",
};

const ROUTER_DIRS = new Set([
  "routers", "routes", "controllers", "api", "endpoints", "views",
]);

const HELPER_DIRS = new Set([
  "helpers", "utils", "utilities", "lib",
]);

const SERVICE_DIRS = new Set([
  "services", "handlers",
]);

export function scanProject(workingDirectory) {
  const projectName = basename(workingDirectory);
  const modules = {};

  const entries = safeReaddir(workingDirectory);
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === "__pycache__" || entry === ".venv" || entry === "venv") continue;

    const fullPath = join(workingDirectory, entry);
    if (!isDirectory(fullPath)) continue;

    const dirName = entry.toLowerCase();

    if (NON_CODE_DIRS.has(dirName)) continue;

    const knownPurpose = KNOWN_MODULE_PURPOSES[dirName];

    if (knownPurpose) {
      modules[entry + "/"] = buildModuleInfo(dirName, knownPurpose);
    } else {
      const inferred = inferModulePurpose(fullPath);
      if (inferred) {
        modules[entry + "/"] = inferred;
      } else {
        modules[entry + "/"] = { purpose: "Project module", allowed: [], forbidden: [] };
      }
    }

    scanSubdirectories(fullPath, entry, workingDirectory, modules);
  }

  return { projectName, modules };
}

function scanSubdirectories(dirPath, prefix, rootDir, modules, maxDepth = 6, currentDepth = 2) {
  if (currentDepth > maxDepth) return;

  const entries = safeReaddir(dirPath);
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === "__pycache__" || entry === ".venv" || entry === "venv") continue;

    const fullPath = join(dirPath, entry);
    if (!isDirectory(fullPath)) continue;

    const dirName = entry.toLowerCase();

    if (NON_CODE_DIRS.has(dirName)) continue;

    const modulePath = prefix + "/" + entry + "/";
    const knownPurpose = KNOWN_MODULE_PURPOSES[dirName];

    if (knownPurpose) {
      modules[modulePath] = buildModuleInfo(dirName, knownPurpose);
    } else {
      const inferred = inferModulePurpose(fullPath);
      if (inferred) {
        modules[modulePath] = inferred;
      } else {
        modules[modulePath] = { purpose: "Project module", allowed: [], forbidden: [] };
      }
    }

    scanSubdirectories(fullPath, prefix + "/" + entry, rootDir, modules, maxDepth, currentDepth + 1);
  }
}

function buildModuleInfo(dirName, purpose) {
  const info = { purpose, allowed: [], forbidden: [] };

  if (ROUTER_DIRS.has(dirName)) {
    info.allowed = ["route definitions", "endpoint handlers"];
    info.forbidden = ["helper functions", "utility functions", "business logic", "data models"];
  } else if (HELPER_DIRS.has(dirName)) {
    info.allowed = ["utility functions", "helper functions", "shared logic"];
    info.forbidden = ["route definitions", "endpoint handlers", "middleware"];
  } else if (SERVICE_DIRS.has(dirName)) {
    info.allowed = ["business logic", "service functions", "orchestration"];
    info.forbidden = ["route definitions", "endpoint handlers"];
  } else if (dirName === "models" || dirName === "schemas") {
    info.allowed = ["data models", "schemas", "type definitions"];
    info.forbidden = ["business logic", "route handlers", "utility functions"];
  } else if (dirName === "tests" || dirName === "test" || dirName === "specs") {
    info.allowed = ["test functions", "test fixtures", "test helpers"];
    info.forbidden = ["production code", "business logic"];
  } else if (dirName === "middleware") {
    info.allowed = ["middleware classes", "middleware functions"];
    info.forbidden = ["route handlers", "data models"];
  }

  return info;
}

function inferModulePurpose(dirPath) {
  const files = safeReaddir(dirPath).filter((f) => {
    const fullPath = join(dirPath, f);
    return !isDirectory(fullPath) && isCodeFile(f);
  });

  if (files.length === 0) return null;

  const sampled = files.slice(0, 3);
  const signatures = [];

  for (const file of sampled) {
    try {
      const content = readFileSync(join(dirPath, file), "utf8");
      const lines = content.split("\n").slice(0, 50);
      for (const line of lines) {
        if (/^(class|def|function|export|const|let|var|type|interface)\s/.test(line.trim())) {
          signatures.push(line.trim());
        }
      }
    } catch {
      continue;
    }
  }

  if (signatures.length === 0) return null;

  const combined = signatures.join("\n").toLowerCase();
  if (combined.includes("router") || combined.includes("endpoint") || combined.includes("@app.") || combined.includes("@router.")) {
    return buildModuleInfo("routers", "Route/endpoint definitions (inferred)");
  }
  if (combined.includes("service") || combined.includes("manager")) {
    return buildModuleInfo("services", "Service/business logic (inferred)");
  }
  if (combined.includes("helper") || combined.includes("util")) {
    return buildModuleInfo("helpers", "Helper/utility functions (inferred)");
  }
  if (combined.includes("model") || combined.includes("schema") || combined.includes("basemodel")) {
    return buildModuleInfo("models", "Data models (inferred)");
  }
  if (combined.includes("test_") || combined.includes("describe(") || combined.includes("it(")) {
    return buildModuleInfo("tests", "Test suite (inferred)");
  }

  return { purpose: "Project module (inferred from code)", allowed: [], forbidden: [] };
}

export function extractClaudeMdRules(workingDirectory) {
  const rules = [];
  const possiblePaths = [
    join(workingDirectory, "CLAUDE.md"),
    join(workingDirectory, ".claude", "CLAUDE.md"),
  ];

  const NOISE_PATTERNS = [
    /^\*\*[a-z].*\*\*\s*[-–]/i,
    /^├──/,
    /^└──/,
    /^│/,
    /^```/,
    /^\[tool\./,
    /^#\s/,
    /^##\s/,
    /Support\*\*:/,
    /Manager\*\*:/,
    /System\*\*:/,
  ];

  for (const mdPath of possiblePaths) {
    if (!existsSync(mdPath)) continue;

    try {
      const content = readFileSync(mdPath, "utf8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (NOISE_PATTERNS.some((p) => p.test(trimmed))) continue;

        const hasImperative =
          /\bDO NOT\b/.test(trimmed) ||
          /\bNEVER\b/.test(trimmed) ||
          /\bMUST\b/.test(trimmed) ||
          /\bSHOULD NOT\b/.test(trimmed) ||
          /\bFORBIDDEN\b/.test(trimmed) ||
          /\bALWAYS\b/.test(trimmed) ||
          /!=\s*FIXING/.test(trimmed);

        const isBoldDirective = /^\*\*[A-Z]{2,}/.test(trimmed);

        if (!hasImperative && !isBoldDirective) continue;

        const cleaned = trimmed
          .replace(/^\*\*/g, "")
          .replace(/\*\*$/g, "")
          .replace(/\*\*/g, "")
          .replace(/^-\s+/, "")
          .trim();

        if (cleaned.length > 15 && cleaned.length < 200) {
          rules.push(cleaned);
        }
      }
    } catch {
      continue;
    }
  }

  return [...new Set(rules)];
}

export function isRouterDirectory(filePath, modules) {
  for (const [modulePath, info] of Object.entries(modules)) {
    if (filePath.includes(modulePath)) {
      const dirName = modulePath.replace(/\/$/, "").split("/").pop().toLowerCase();
      return ROUTER_DIRS.has(dirName);
    }
  }
  return false;
}

export function getModuleForFile(filePath, workingDirectory, modules) {
  const rel = relative(workingDirectory, filePath).replace(/\\/g, "/");

  let bestMatch = null;
  let bestLength = 0;
  for (const modulePath of Object.keys(modules)) {
    if (rel.startsWith(modulePath) && modulePath.length > bestLength) {
      bestMatch = modulePath;
      bestLength = modulePath.length;
    }
  }

  return bestMatch ? { path: bestMatch, ...modules[bestMatch] } : null;
}

function safeReaddir(dirPath) {
  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function isDirectory(fullPath) {
  try {
    return statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}
