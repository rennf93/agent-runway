import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { scanProject, validateConventions, tmpDataDir, cleanupTmpDirs, SAMPLE_PROJECT, FIXTURES } from "./helpers.mjs";

const VIOLATIONS = join(FIXTURES, "violations");
const CLEAN = join(FIXTURES, "clean");
let dataDir;

before(async () => {
  dataDir = tmpDataDir();
  await scanProject(SAMPLE_PROJECT, dataDir);
});

after(() => cleanupTmpDirs());

describe("validate-conventions.mjs", () => {
  describe("Python violations", () => {
    it("catches comments, noqa, type:ignore, pylint, pragma, fmt, and print", async () => {
      const result = await validateConventions(join(VIOLATIONS, "python-all-violations.py"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("no_inline_comments"));
      assert.ok(result.stderr.includes("no_lint_suppressions"));
      assert.ok(result.stderr.includes("no_noqa"));
      assert.ok(result.stderr.includes("no_type_ignore"));
      assert.ok(result.stderr.includes("print"));
    });

    it("does not flag shebang or encoding declaration", async () => {
      const result = await validateConventions(join(VIOLATIONS, "python-all-violations.py"), dataDir);

      assert.ok(!result.stderr.includes("#!/usr/bin/env"));
      assert.ok(!result.stderr.includes("coding: utf-8"));
    });
  });

  describe("TypeScript suppressions", () => {
    it("catches @ts-ignore, @ts-nocheck, eslint-disable, biome-ignore", async () => {
      const result = await validateConventions(join(VIOLATIONS, "typescript-suppressions.ts"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("@ts-ignore"));
      assert.ok(result.stderr.includes("@ts-nocheck"));
      assert.ok(result.stderr.includes("eslint-disable"));
      assert.ok(result.stderr.includes("biome-ignore"));
    });
  });

  describe("Go suppressions", () => {
    it("catches nolint and nosec", async () => {
      const result = await validateConventions(join(VIOLATIONS, "go-suppressions.go"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("nolint"));
      assert.ok(result.stderr.includes("nosec"));
    });
  });

  describe("Java suppressions", () => {
    it("catches @SuppressWarnings, NOSONAR, NOPMD", async () => {
      const result = await validateConventions(join(VIOLATIONS, "java-suppressions.java"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("@SuppressWarnings"));
      assert.ok(result.stderr.includes("NOSONAR"));
      assert.ok(result.stderr.includes("NOPMD"));
    });
  });

  describe("C++ suppressions", () => {
    it("catches NOLINT, pragma warning, GCC diagnostic", async () => {
      const result = await validateConventions(join(VIOLATIONS, "cpp-suppressions.cpp"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("NOLINT"));
      assert.ok(result.stderr.includes("pragma warning disable"));
      assert.ok(result.stderr.includes("GCC diagnostic ignored"));
    });
  });

  describe("Rust suppressions", () => {
    it("catches #[allow(...)] and #![allow(...)]", async () => {
      const result = await validateConventions(join(VIOLATIONS, "rust-suppressions.rs"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("#[allow("));
      assert.ok(result.stderr.includes("#![allow("));
    });
  });

  describe("Swift suppressions", () => {
    it("catches swiftlint:disable and swift-format-ignore", async () => {
      const result = await validateConventions(join(VIOLATIONS, "swift-suppressions.swift"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("swiftlint:disable"));
      assert.ok(result.stderr.includes("swift-format-ignore"));
    });
  });

  describe("Shell suppressions", () => {
    it("catches shellcheck disable", async () => {
      const result = await validateConventions(join(VIOLATIONS, "shell-suppressions.sh"), dataDir);

      assert.equal(result.exitCode, 2);
      assert.ok(result.stderr.includes("shellcheck disable"));
    });
  });

  describe("Clean files", () => {
    it("passes clean Python file", async () => {
      const result = await validateConventions(join(CLEAN, "python-clean.py"), dataDir);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "");
    });

    it("passes clean TypeScript file", async () => {
      const result = await validateConventions(join(CLEAN, "typescript-clean.ts"), dataDir);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "");
    });

    it("passes clean Go file", async () => {
      const result = await validateConventions(join(CLEAN, "go-clean.go"), dataDir);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "");
    });
  });

  describe("Edge cases", () => {
    it("skips non-code files", async () => {
      const result = await validateConventions(join(SAMPLE_PROJECT, "CLAUDE.md"), dataDir);
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "");
    });

    it("handles nonexistent file", async () => {
      const result = await validateConventions("/tmp/nonexistent-99999.py", dataDir);
      assert.equal(result.exitCode, 0);
    });

    it("handles missing file_path", async () => {
      const { runScript } = await import("./helpers.mjs");
      const result = await runScript("validate-conventions.mjs", { tool_input: {} }, dataDir);
      assert.equal(result.exitCode, 0);
    });

    it("handles invalid custom regex without crashing", async () => {
      const { writeFileSync, mkdtempSync, rmSync } = await import("fs");
      const badDir = mkdtempSync("/tmp/ar-badrx-");
      writeFileSync(join(badDir, ".agent-runway.yml"), `conventions:\n  custom:\n    - pattern: "[bad(regex"\n      message: "Bad"\n      enforcement: warn\n`);
      writeFileSync(join(badDir, "test.py"), "x = 1\n");

      const badData = tmpDataDir();
      await scanProject(badDir, badData);
      const result = await validateConventions(join(badDir, "test.py"), badData);

      assert.equal(result.exitCode, 0);
      assert.ok(result.json?.hookSpecificOutput?.additionalContext?.includes("Invalid regex"));

      rmSync(badDir, { recursive: true });
    });
  });
});
