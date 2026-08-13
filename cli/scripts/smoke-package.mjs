import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "codeshot-package-"));

try {
  const pack = run("npm", ["pack", "--json", "--pack-destination", temporaryDirectory]);
  const [{ filename }] = JSON.parse(pack.stdout);
  const installDirectory = join(temporaryDirectory, "install");
  run("npm", ["install", "--ignore-scripts", "--prefix", installDirectory, join(temporaryDirectory, filename)]);
  const packageDirectory = join(installDirectory, "node_modules", "codeshot.dev");
  const packageJson = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
  const result = run(process.execPath, [join(packageDirectory, packageJson.bin.codeshot), "--version"]);
  if (result.stdout.trim() !== packageJson.version) {
    throw new Error(`Expected version ${packageJson.version}, received ${result.stdout.trim()}.`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result;
}
