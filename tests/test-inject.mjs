import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { scanProject, injectContext, tmpDataDir, cleanupTmpDirs, SAMPLE_PROJECT } from "./helpers.mjs";

let dataDir;

before(async () => {
  dataDir = tmpDataDir();
  await scanProject(SAMPLE_PROJECT, dataDir);
});

after(() => cleanupTmpDirs());

describe("inject-context.mjs", () => {
  it("injects architectural context into subagent prompt", async () => {
    const result = await injectContext("Refactor middleware", { subagent_type: "general-purpose" }, dataDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.json);

    const output = result.json.hookSpecificOutput;
    assert.equal(output.permissionDecision, "allow");
    assert.ok(output.updatedInput.prompt.startsWith("=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ==="));
    assert.ok(output.updatedInput.prompt.includes("Refactor middleware"));
    assert.ok(output.updatedInput.prompt.includes("Module Boundaries:"));
    assert.ok(output.updatedInput.prompt.includes("routers/"));
    assert.ok(output.updatedInput.prompt.includes("NO INLINE COMMENTS"));
    assert.ok(output.updatedInput.prompt.includes("CLAUDE.md Rules"));
  });

  it("preserves all original tool_input fields", async () => {
    const result = await injectContext("Do something", {
      subagent_type: "general-purpose",
      description: "test task",
      model: "sonnet",
    }, dataDir);

    const updated = result.json.hookSpecificOutput.updatedInput;
    assert.equal(updated.subagent_type, "general-purpose");
    assert.equal(updated.description, "test task");
    assert.equal(updated.model, "sonnet");
  });

  it("prevents double injection", async () => {
    const alreadyInjected = "=== AGENT RUNWAY: ARCHITECTURAL CONTEXT ===\nstuff\n=== END ===\nOriginal task";
    const result = await injectContext(alreadyInjected, {}, dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.json, null);
  });

  it("exits silently when no prompt", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("inject-context.mjs", { tool_input: { subagent_type: "general-purpose" } }, dataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
  });

  it("exits silently when no arch-map", async () => {
    const emptyDataDir = tmpDataDir();
    const result = await injectContext("Do something", {}, emptyDataDir);

    assert.equal(result.exitCode, 0);
    assert.equal(result.json, null);
  });

  it("exits silently on empty stdin", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("inject-context.mjs", "", dataDir);
    assert.equal(result.exitCode, 0);
  });

  it("exits silently on malformed JSON", async () => {
    const { runScript } = await import("./helpers.mjs");
    const result = await runScript("inject-context.mjs", "garbage", dataDir);
    assert.equal(result.exitCode, 0);
  });

  it("handles very long prompts without truncating original", async () => {
    const longPrompt = "x".repeat(5000);
    const result = await injectContext(longPrompt, {}, dataDir);

    const injected = result.json.hookSpecificOutput.updatedInput.prompt;
    assert.ok(injected.includes("x".repeat(100)));
    assert.ok(injected.startsWith("=== AGENT RUNWAY"));
  });
});
