import ky, { HTTPError } from "ky";
import { Type } from "typebox";
import { Value } from "typebox/value";
import type { CliApi, RenderInput, RenderResult } from "./run.js";

const ApiError = Type.Object({ code: Type.String(), message: Type.String() });

export function createApi(serverUrl: string): CliApi {
  const client = ky.create({ prefix: serverUrl.replace(/\/$/, ""), retry: 0, timeout: 30_000 });

  return {
    async render(input: RenderInput): Promise<RenderResult> {
      try {
        const response = await client.post("v1/screenshots", { json: input });
        if (response.headers.get("content-type")?.split(";", 1)[0] !== "image/png") {
          throw new Error("codeshot.dev returned an invalid screenshot.");
        }
        const png = new Uint8Array(await response.arrayBuffer());
        if (png.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte)) {
          throw new Error("codeshot.dev returned an invalid screenshot.");
        }
        return {
          png,
          theme: response.headers.get("x-codeshot-theme") ?? input.theme,
        };
      } catch (error) {
        throw await readableApiError(error);
      }
    },
    capabilities: () => requestJson(client.get("v1/capabilities")),
    resolveTheme: (theme: string) => requestJson(client.get("v1/themes/resolve", { searchParams: { theme } })),
  };
}

async function requestJson(request: Promise<Response>): Promise<unknown> {
  try {
    return await (await request).json();
  } catch (error) {
    throw await readableApiError(error);
  }
}

async function readableApiError(error: unknown): Promise<Error> {
  if (!(error instanceof HTTPError)) return error instanceof Error ? error : new Error("Request failed.");
  const body = error.data ?? await error.response.json().catch(() => null);
  if (Value.Check(ApiError, body)) return new Error(`${body.message} (${body.code})`);
  return new Error(`codeshot.dev returned HTTP ${error.response.status}.`);
}
