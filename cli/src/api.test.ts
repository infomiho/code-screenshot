import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApi } from "./api.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("codeshot API client", () => {
  it("posts render input and returns PNG metadata", async () => {
    const server = createServer((request, response) => {
      expect(request.method).toBe("POST");
      expect(request.url).toBe("/v1/screenshots");
      expect(request.headers["x-codeshot-client"]).toBe("cli");
      response.setHeader("content-type", "image/png");
      response.setHeader("x-codeshot-theme", "builtin:macos@1");
      response.end(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start.");

    const result = await createApi(`http://127.0.0.1:${address.port}`).render({
      code: "x", customizations: {}, highlightedLines: [], language: "text", scale: 1, theme: "macos", title: "", width: 420,
    });
    expect(result.theme).toBe("builtin:macos@1");
    expect(result.png).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("translates structured render errors", async () => {
    const server = createServer((_request, response) => {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ code: "unknown_language", message: "Unknown language: rb" }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start.");

    await expect(createApi(`http://127.0.0.1:${address.port}`).render({
      code: "x", customizations: {}, highlightedLines: [], language: "rb", scale: 1, theme: "macos", title: "", width: 420,
    })).rejects.toThrow("Unknown language: rb (unknown_language)");
  });
});
