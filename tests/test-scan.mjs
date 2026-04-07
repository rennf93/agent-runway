import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { scanProject, readArchMap, tmpDataDir, cleanupTmpDirs, SAMPLE_PROJECT, PLUGIN_ROOT } from "./helpers.mjs";

after(() => cleanupTmpDirs());

describe("scan-project.mjs", () => {
  it("scans sample project with config", async () => {
    const dataDir = tmpDataDir();
    const result = await scanProject(SAMPLE_PROJECT, dataDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.json);
    assert.ok(result.json.hookSpecificOutput.additionalContext.includes("Runway"));

    const map = readArchMap(dataDir);
    assert.ok(map);
    assert.equal(map.project_name, "sample-project");
    assert.ok(map.modules["routers/"]);
    assert.ok(map.modules["services/"]);
    assert.ok(map.modules["helpers/"]);
    assert.ok(map.modules["models/"]);
    assert.ok(map.modules["tests/"]);
    assert.deepEqual(map.modules["routers/"].forbidden, [
      "helper functions", "business logic", "utility functions",
    ]);
  });

  it("extracts CLAUDE.md rules without noise", async () => {
    const dataDir = tmpDataDir();
    await scanProject(SAMPLE_PROJECT, dataDir);
    const map = readArchMap(dataDir);

    assert.equal(map.claude_md_rules.length, 4);
    assert.ok(map.claude_md_rules.some((r) => r.includes("DO NOT LEAVE ANY COMMENTS")));
    assert.ok(map.claude_md_rules.some((r) => r.includes("NEVER use print()")));
    assert.ok(map.claude_md_rules.some((r) => r.includes("ALWAYS put business logic")));
    assert.ok(map.claude_md_rules.some((r) => r.includes("DO NOT use # noqa")));
  });

  it("applies config conventions with block enforcement", async () => {
    const dataDir = tmpDataDir();
    await scanProject(SAMPLE_PROJECT, dataDir);
    const map = readArchMap(dataDir);

    assert.equal(map.conventions.no_inline_comments.enforcement, "block");
    assert.equal(map.conventions.no_noqa.enforcement, "block");
    assert.equal(map.conventions.no_type_ignore.enforcement, "block");
    assert.equal(map.conventions.no_helpers_in_routers.enforcement, "block");
    assert.equal(map.conventions.custom.length, 1);
    assert.ok(map.conventions.custom[0].pattern.includes("print"));
  });

  it("generates context block under max_size", async () => {
    const dataDir = tmpDataDir();
    await scanProject(SAMPLE_PROJECT, dataDir);
    const map = readArchMap(dataDir);

    assert.ok(map.context_block.length > 0);
    assert.ok(map.context_block.length <= 3000);
  });

  it("scans plugin repo itself (no config)", async () => {
    const dataDir = tmpDataDir();
    const result = await scanProject(PLUGIN_ROOT, dataDir);
    const map = readArchMap(dataDir);

    assert.equal(result.exitCode, 0);
    assert.ok(map);
    assert.ok(map.modules["scripts/"]);
    assert.ok(!map.modules["docs/"]);
  });

  it("handles empty directory", async () => {
    const emptyDir = mkdtempSync("/tmp/ar-empty-");
    const dataDir = tmpDataDir();
    const result = await scanProject(emptyDir, dataDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.json);

    const map = readArchMap(dataDir);
    assert.equal(Object.keys(map.modules).length, 0);

    rmSync(emptyDir, { recursive: true });
  });

  it("handles nonexistent directory", async () => {
    const dataDir = tmpDataDir();
    const result = await scanProject("/tmp/nonexistent-dir-99999", dataDir);
    assert.equal(result.exitCode, 0);
  });

  it("handles empty stdin gracefully", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("scan-project.mjs", "");
    assert.equal(result.exitCode, 0);
  });

  it("handles malformed JSON stdin", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("scan-project.mjs", "not json");
    assert.equal(result.exitCode, 0);
  });

  it("handles large project within timeout", async () => {
    const largeDir = mkdtempSync("/tmp/ar-large-");
    for (let i = 0; i < 50; i++) {
      const modDir = join(largeDir, `module_${i}`);
      mkdirSync(modDir);
      writeFileSync(join(modDir, "main.py"), `def func_${i}(): pass\n`);
    }

    const dataDir = tmpDataDir();
    const result = await scanProject(largeDir, dataDir);
    const map = readArchMap(dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(Object.keys(map.modules).length, 50);
    assert.ok(map.context_block.length <= 3000);

    rmSync(largeDir, { recursive: true });
  });

  it("handles spaces in directory path", async () => {
    const spacedDir = mkdtempSync("/tmp/ar spaced-");
    mkdirSync(join(spacedDir, "routers"));
    writeFileSync(join(spacedDir, "routers", "main.py"), "def helper(): pass\n");

    const dataDir = tmpDataDir();
    const result = await scanProject(spacedDir, dataDir);
    const map = readArchMap(dataDir);

    assert.equal(result.exitCode, 0);
    assert.ok(map.modules["routers/"]);

    rmSync(spacedDir, { recursive: true });
  });
});
