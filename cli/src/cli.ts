#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { createApi } from "./api.js";
import { run } from "./run.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
const serverUrl = process.env.CODESHOT_API_URL ?? "https://api.codeshot.dev";

async function readInput(path?: string) {
  if (path) return readFile(path, "utf8");
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function writePng(path: string, png: Uint8Array) {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, png, { flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

process.exitCode = await run(process.argv.slice(2), {
  api: createApi(serverUrl),
  version,
  readInput,
  writePng,
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
});
