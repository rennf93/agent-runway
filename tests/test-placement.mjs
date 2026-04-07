import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { scanProject, validatePlacement, tmpDataDir, cleanupTmpDirs, SAMPLE_PROJECT, FIXTURES } from "./helpers.mjs";

const VIOLATIONS = join(FIXTURES, "violations");
let dataDir;
let testProjectDir;

before(async () => {
  dataDir = tmpDataDir();
  await scanProject(SAMPLE_PROJECT, dataDir);

  testProjectDir = mkdtempSync("/tmp/ar-placement-");
  mkdirSync(join(testProjectDir, "routers"), { recursive: true });
  copyFileSync(
    join(VIOLATIONS, "router-with-helpers.py"),
    join(testProjectDir, "routers", "users.py")
  );
});

after(() => {
  cleanupTmpDirs();
  if (testProjectDir) rmSync(testProjectDir, { recursive: true, force: true });
});

describe("validate-placement.mjs", () => {
  it("flags helper functions in router file", async () => {
    const placementData = tmpDataDir();
    await scanProject(testProjectDir, placementData);

    const result = await validatePlacement(join(testProjectDir, "routers", "users.py"), placementData);

    const output = result.exitCode === 2 ? result.stderr : result.stdout;
    assert.ok(output.includes("format_user_for_response"));
    assert.ok(!output.includes("validate_user_input"));
  });

  it("does NOT flag decorated route handlers", async () => {
    const placementData = tmpDataDir();
    await scanProject(testProjectDir, placementData);

    const result = await validatePlacement(join(testProjectDir, "routers", "users.py"), placementData);

    assert.ok(!result.stderr.includes('"get_user"'));
    assert.ok(!result.stderr.includes('"list_users"'));
  });

  it("passes clean router file", async () => {
    const result = await validatePlacement(join(SAMPLE_PROJECT, "routers", "users.py"), dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  });

  it("passes helpers in helpers directory", async () => {
    const result = await validatePlacement(join(SAMPLE_PROJECT, "helpers", "formatting.py"), dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  });

  it("passes services in services directory", async () => {
    const result = await validatePlacement(join(SAMPLE_PROJECT, "services", "users.py"), dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  });

  it("passes models in models directory", async () => {
    const result = await validatePlacement(join(SAMPLE_PROJECT, "models", "user.py"), dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  });

  it("skips files outside any module", async () => {
    const standaloneDir = mkdtempSync("/tmp/ar-standalone-");
    const standaloneFile = join(standaloneDir, "script.py");
    writeFileSync(standaloneFile, "def helper(): pass\n");

    const result = await validatePlacement(standaloneFile, dataDir);
    assert.equal(result.exitCode, 0);

    rmSync(standaloneDir, { recursive: true });
  });

  it("skips non-code files", async () => {
    const result = await validatePlacement(join(SAMPLE_PROJECT, "CLAUDE.md"), dataDir);
    assert.equal(result.exitCode, 0);
  });

  it("handles nonexistent file", async () => {
    const result = await validatePlacement("/tmp/nonexistent-99999.py", dataDir);
    assert.equal(result.exitCode, 0);
  });

  it("handles missing file_path", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("validate-placement.mjs", { tool_input: {} }, dataDir);
    assert.equal(result.exitCode, 0);
  });
});
