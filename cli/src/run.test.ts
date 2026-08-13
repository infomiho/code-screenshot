import { describe, expect, it, vi } from "vitest";
import { run, type CliApi, type CliDependencies } from "./run.js";

function dependencies(api: Partial<CliApi> = {}): CliDependencies {
  return {
    api: {
      render: vi.fn().mockResolvedValue({ png: new Uint8Array([137, 80, 78, 71]), theme: "builtin:macos@1" }),
      capabilities: vi.fn().mockResolvedValue({ themes: [{ id: "macos" }] }),
      resolveTheme: vi.fn().mockResolvedValue({ reference: "builtin:macos@1" }),
      ...api,
    },
    version: "1.2.3",
    readInput: vi.fn().mockResolvedValue("const answer = 42"),
    writePng: vi.fn(),
    stdout: vi.fn(),
    stderr: vi.fn(),
  };
}

describe("codeshot CLI", () => {
  it("renders a file with inferred metadata and writes the PNG", async () => {
    const deps = dependencies();
    const exitCode = await run([
      "render", "src/example.ts", "--theme", "technical-plate", "--highlight", "1,3-4", "--customize", "desktop-backdrop=midnight",
    ], deps);

    expect(deps.api.render).toHaveBeenCalledWith({
      code: "const answer = 42",
      customizations: { "desktop-backdrop": "midnight" },
      highlightedLines: [1, 3, 4],
      language: "typescript",
      scale: 2,
      theme: "technical-plate",
      title: "example.ts",
      width: 860,
    });
    expect(deps.writePng).toHaveBeenCalledWith("example.png", expect.any(Uint8Array));
    expect(deps.stdout).toHaveBeenCalledWith("example.png\n");
    expect(exitCode).toBe(0);
  });

  it("requires a language for stdin", async () => {
    const deps = dependencies();
    const exitCode = await run(["render", "-"], deps);

    expect(deps.api.render).not.toHaveBeenCalled();
    expect(deps.stderr).toHaveBeenCalledWith(expect.stringContaining("Pass --language"));
    expect(exitCode).toBe(1);
  });

  it("rejects an unsupported scale before rendering", async () => {
    const deps = dependencies();
    const exitCode = await run(["render", "example.ts", "--scale", "3"], deps);

    expect(deps.api.render).not.toHaveBeenCalled();
    expect(exitCode).not.toBe(0);
  });

  it("prints API failures without a stack trace", async () => {
    const deps = dependencies({ render: vi.fn().mockRejectedValue(new Error("Renderer is busy. (render_capacity_exceeded)")) });
    const exitCode = await run(["render", "example.ts"], deps);

    expect(deps.stderr).toHaveBeenCalledWith("Renderer is busy. (render_capacity_exceeded)\n");
    expect(exitCode).toBe(1);
  });

});
