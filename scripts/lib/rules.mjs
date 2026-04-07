const SHEBANG_RE = /^#!\//;
const ENCODING_RE = /^#.*coding[=:]/;
const TYPE_HINT_RE = /^#\s*type:\s*(?!ignore)/;
const PRAGMA_RE = /^#\s*pragma/;
const PYTHON_FUNC_RE = /^(?:async\s+)?def\s+(\w+)\s*\(/;
const JS_FUNC_RE = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const JS_ARROW_RE = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/;

const SLASH_COMMENT_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".go", ".rs", ".java", ".kt", ".scala",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
]);

const HASH_COMMENT_EXTENSIONS = new Set([
  ".py", ".rb", ".sh", ".bash", ".zsh", ".pl", ".pm",
  ".r", ".R", ".jl", ".ex", ".exs", ".cr",
]);

const ROUTE_DECORATOR_PATTERNS = [
  /@(?:app|router|blueprint)\.\s*(?:get|post|put|patch|delete|head|options|route)\s*\(/,
  /@(?:api_view|action|require_http_methods)/,
  /app\.(?:get|post|put|patch|delete|all|use)\s*\(/,
  /router\.(?:get|post|put|patch|delete|all|use)\s*\(/,
  /\.(Get|Post|Put|Patch|Delete|Head|Options)\s*\(/,
];

const SUPPRESSION_PATTERNS = {
  python: [
    { re: /#\s*noqa/, label: "noqa" },
    { re: /#\s*type:\s*ignore/, label: "type: ignore" },
    { re: /#\s*pylint:\s*disable/, label: "pylint: disable" },
    { re: /#\s*pragma:\s*no\s*cover/, label: "pragma: no cover" },
    { re: /#\s*fmt:\s*(off|skip)/, label: "fmt: off/skip" },
    { re: /#\s*isort:\s*(skip|off)/, label: "isort: skip" },
    { re: /#\s*mypy:\s*ignore/, label: "mypy: ignore" },
  ],
  ruby: [
    { re: /#\s*rubocop:\s*disable/, label: "rubocop: disable" },
    { re: /#\s*steep:ignore/, label: "steep:ignore" },
    { re: /#\s*sorbet:\s*ignore/, label: "sorbet: ignore" },
  ],
  javascript: [
    { re: /\/\/\s*eslint-disable/, label: "eslint-disable" },
    { re: /\/\*\s*eslint-disable/, label: "eslint-disable (block)" },
    { re: /\/\/\s*@ts-ignore/, label: "@ts-ignore" },
    { re: /\/\/\s*@ts-nocheck/, label: "@ts-nocheck" },
    { re: /\/\/\s*@ts-expect-error/, label: "@ts-expect-error" },
    { re: /\/\/\s*biome-ignore/, label: "biome-ignore" },
    { re: /\/\/\s*prettier-ignore/, label: "prettier-ignore" },
    { re: /\/\/\s*@flow-ignore/, label: "@flow-ignore" },
    { re: /\/\/\s*c8\s+ignore/, label: "c8 ignore" },
    { re: /\/\/\s*istanbul\s+ignore/, label: "istanbul ignore" },
    { re: /\/\/\s*v8\s+ignore/, label: "v8 ignore" },
  ],
  go: [
    { re: /\/\/\s*nolint/, label: "nolint" },
    { re: /\/\/\s*nosec/, label: "nosec" },
    { re: /\/\/\s*go:nosplit/, label: "go:nosplit" },
    { re: /\/\/\s*go:noinline/, label: "go:noinline" },
    { re: /\/\/\s*go:noescape/, label: "go:noescape" },
    { re: /\/\/\s*exhaustive:ignore/, label: "exhaustive:ignore" },
  ],
  rust: [
    { re: /#\[allow\(/, label: "#[allow(...)]" },
    { re: /#!\[allow\(/, label: "#![allow(...)]" },
    { re: /#\[cfg_attr\(.*allow/, label: "#[cfg_attr(...allow)]" },
    { re: /\/\/\s*SAFETY:/, label: "SAFETY: (verify intent)" },
  ],
  java: [
    { re: /@SuppressWarnings/, label: "@SuppressWarnings" },
    { re: /\/\/\s*CHECKSTYLE:\s*OFF/, label: "CHECKSTYLE: OFF" },
    { re: /\/\/\s*NOSONAR/, label: "NOSONAR" },
    { re: /\/\/\s*NOPMD/, label: "NOPMD" },
    { re: /\/\/\s*spotbugs:ignore/, label: "spotbugs:ignore" },
  ],
  kotlin: [
    { re: /@Suppress\(/, label: "@Suppress" },
    { re: /\/\/\s*ktlint-disable/, label: "ktlint-disable" },
    { re: /@file:\s*Suppress/, label: "@file:Suppress" },
  ],
  scala: [
    { re: /\/\/\s*scalafix:off/, label: "scalafix:off" },
    { re: /\/\/\s*scalastyle:off/, label: "scalastyle:off" },
    { re: /@SuppressWarnings/, label: "@SuppressWarnings" },
  ],
  c_cpp: [
    { re: /\/\/\s*NOLINT/, label: "NOLINT" },
    { re: /\/\/\s*NOLINTNEXTLINE/, label: "NOLINTNEXTLINE" },
    { re: /#pragma\s+warning\s*\(\s*disable/, label: "pragma warning disable" },
    { re: /#pragma\s+GCC\s+diagnostic\s+ignored/, label: "GCC diagnostic ignored" },
    { re: /#pragma\s+clang\s+diagnostic\s+ignored/, label: "clang diagnostic ignored" },
    { re: /\/\/\s*GCOVR_EXCL/, label: "GCOVR_EXCL" },
  ],
  csharp: [
    { re: /#pragma\s+warning\s+disable/, label: "pragma warning disable" },
    { re: /\/\/\s*ReSharper\s+disable/, label: "ReSharper disable" },
    { re: /\[SuppressMessage\(/, label: "SuppressMessage" },
  ],
  swift: [
    { re: /\/\/\s*swiftlint:disable/, label: "swiftlint:disable" },
    { re: /\/\/\s*swift-format-ignore/, label: "swift-format-ignore" },
  ],
  php: [
    { re: /\/\/\s*phpcs:ignore/, label: "phpcs:ignore" },
    { re: /\/\/\s*@phpstan-ignore/, label: "@phpstan-ignore" },
    { re: /\/\*\*?\s*@noinspection/, label: "@noinspection" },
    { re: /\/\/\s*psalm-suppress/, label: "psalm-suppress" },
  ],
  shell: [
    { re: /#\s*shellcheck\s+disable/, label: "shellcheck disable" },
  ],
};

const EXT_TO_LANGUAGE = {
  ".py": "python",
  ".pyi": "python",
  ".rb": "ruby",
  ".js": "javascript",
  ".ts": "javascript",
  ".jsx": "javascript",
  ".tsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".c": "c_cpp",
  ".cpp": "c_cpp",
  ".cc": "c_cpp",
  ".cxx": "c_cpp",
  ".h": "c_cpp",
  ".hpp": "c_cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".php": "php",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
};

function getFileExtension(filePath) {
  if (!filePath) return "";
  return filePath.slice(filePath.lastIndexOf("."));
}

function getLanguage(filePath) {
  return EXT_TO_LANGUAGE[getFileExtension(filePath)] || null;
}

function stripStringLiterals(line) {
  if (/^\s*(?:"""|''')/.test(line)) return line;

  let result = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i];

    if (ch === "`") {
      result += " ";
      i++;
      while (i < line.length && line[i] !== "`") {
        if (line[i] === "\\" && i + 1 < line.length) {
          result += "  ";
          i += 2;
        } else {
          result += " ";
          i++;
        }
      }
      if (i < line.length) { result += " "; i++; }
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      result += " ";
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === "\\" && i + 1 < line.length) {
          result += "  ";
          i += 2;
        } else {
          result += " ";
          i++;
        }
      }
      if (i < line.length) { result += " "; i++; }
      continue;
    }

    result += ch;
    i++;
  }
  return result;
}

export function checkNoInlineComments(lines, filePath) {
  const ext = getFileExtension(filePath);
  const useSlash = SLASH_COMMENT_EXTENSIONS.has(ext);
  const useHash = HASH_COMMENT_EXTENSIONS.has(ext);

  if (!useSlash && !useHash) return [];

  const lang = getLanguage(filePath);
  const suppressions = lang ? SUPPRESSION_PATTERNS[lang] || [] : [];

  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const stripped = stripStringLiterals(line);
    const strippedTrimmed = stripped.trim();

    if (useSlash) {
      const hasSlashComment = strippedTrimmed.includes("//");
      const hasBlockComment = /\/\*/.test(strippedTrimmed) || /^\*[\s/]/.test(strippedTrimmed) || /^\*\/$/.test(strippedTrimmed);
      if (!hasSlashComment && !hasBlockComment) continue;

      if (hasSlashComment && /https?:\/\//.test(strippedTrimmed)) {
        const withoutUrls = strippedTrimmed.replace(/https?:\/\/\S+/g, "");
        if (!withoutUrls.includes("//") && !hasBlockComment) continue;
      }
      if (/^\/\/\/\s*<reference/.test(strippedTrimmed)) continue;

      let isSuppression = false;
      for (const s of suppressions) {
        if (s.re.test(trimmed)) { isSuppression = true; break; }
      }
      if (isSuppression) continue;

      const isStandaloneSlash = /^\s*\/\//.test(stripped);
      const hasInlineSlash = !isStandaloneSlash && /\s+\/\/\s/.test(stripped);

      const isBlockStart = /^\s*\/\*/.test(stripped);
      const isBlockContinuation = /^\s*\*[\s/]/.test(stripped);
      const isBlockEnd = /^\s*\*\/$/.test(stripped);
      const hasInlineBlock = !isBlockStart && /\s+\/\*.*\*\//.test(stripped);

      if (isStandaloneSlash || hasInlineSlash || isBlockStart || isBlockContinuation || isBlockEnd || hasInlineBlock) {
        violations.push({ line: i + 1, content: trimmed });
      }
    } else if (useHash) {
      if (!strippedTrimmed.includes("#")) continue;
      if (SHEBANG_RE.test(trimmed)) continue;
      if (ENCODING_RE.test(trimmed)) continue;
      if (TYPE_HINT_RE.test(trimmed)) continue;
      if (PRAGMA_RE.test(trimmed)) continue;

      let isSuppression = false;
      for (const s of suppressions) {
        if (s.re.test(trimmed)) { isSuppression = true; break; }
      }
      if (isSuppression) continue;

      const isStandalone = /^\s*#\s/.test(stripped) || /^\s*#$/.test(stripped);
      const hasInline = !isStandalone && /\s+#\s/.test(stripped);

      if (isStandalone || hasInline) {
        violations.push({ line: i + 1, content: trimmed });
      }
    }
  }
  return violations;
}

export function checkNoLintSuppressions(lines, filePath) {
  const lang = getLanguage(filePath);
  if (!lang) return [];

  const patterns = SUPPRESSION_PATTERNS[lang] || [];
  if (patterns.length === 0) return [];

  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, label } of patterns) {
      if (re.test(line)) {
        violations.push({
          line: i + 1,
          content: `Lint suppression (${label}): ${line.trim()}`,
        });
        break;
      }
    }
  }
  return violations;
}

export function checkNoNoqa(lines) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (/#\s*noqa/.test(lines[i])) {
      violations.push({ line: i + 1, content: lines[i].trim() });
    }
  }
  return violations;
}

export function checkNoTypeIgnore(lines) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (/#\s*type:\s*ignore/.test(lines[i])) {
      violations.push({ line: i + 1, content: lines[i].trim() });
    }
  }
  return violations;
}

export function checkNoHelpersInRouters(lines, filePath) {
  const violations = [];
  const functions = extractFunctions(lines);
  const routeDecorators = findRouteDecorators(lines);

  for (const func of functions) {
    const hasDecorator = routeDecorators.some(
      (decoratorLine) => decoratorLine < func.line && func.line - decoratorLine <= 3
    );

    if (!hasDecorator) {
      violations.push({
        line: func.line,
        content: `Non-route function "${func.name}" in router file. Move to services/ or helpers/.`,
      });
    }
  }

  return violations;
}

export function checkCustomPattern(lines, pattern, message) {
  const violations = [];
  let re;
  try {
    re = new RegExp(pattern);
  } catch {
    violations.push({ line: 0, content: `Invalid regex pattern "${pattern}" in .agent-runway.yml — skipping rule "${message}"` });
    return violations;
  }
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      violations.push({ line: i + 1, content: `${message}: ${lines[i].trim()}` });
    }
  }
  return violations;
}

function extractFunctions(lines) {
  const functions = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = PYTHON_FUNC_RE.exec(line.trim());
    if (match) {
      const name = match[1];
      if (!name.startsWith("_") && name !== "main") {
        functions.push({ name, line: i + 1 });
      }
      continue;
    }
    match = JS_FUNC_RE.exec(line.trim());
    if (match) {
      functions.push({ name: match[1], line: i + 1 });
      continue;
    }
    match = JS_ARROW_RE.exec(line.trim());
    if (match) {
      functions.push({ name: match[1], line: i + 1 });
    }
  }
  return functions;
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
