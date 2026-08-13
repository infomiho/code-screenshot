import { basename, extname } from "node:path";
import { Command, CommanderError, InvalidArgumentError, Option } from "commander";

const languageByExtension: Record<string, string> = {
  ".css": "css",
  ".htm": "html",
  ".html": "html",
  ".js": "javascript",
  ".jsx": "jsx",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".php": "php",
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".txt": "text",
};

export type RenderInput = {
  code: string;
  customizations: Record<string, string>;
  highlightedLines: number[];
  language: string;
  scale: 1 | 2;
  theme: string;
  title: string;
  width: number;
};

export type RenderResult = { png: Uint8Array; theme: string };

export type CliApi = {
  render(input: RenderInput): Promise<RenderResult>;
  capabilities(): Promise<unknown>;
  resolveTheme(theme: string): Promise<unknown>;
};

export type CliDependencies = {
  api: CliApi;
  version: string;
  readInput(path: string): Promise<string>;
  writePng(path: string, png: Uint8Array): Promise<void>;
  stdout(value: string): void;
  stderr(value: string): void;
};

type RenderOptions = {
  customize: string[];
  highlight: number[];
  language?: string;
  output?: string;
  scale: 1 | 2;
  theme: string;
  title?: string;
  width: number;
};

export async function run(args: string[], dependencies: CliDependencies): Promise<number> {
  const program = new Command()
    .name("codeshot")
    .description("Turn source code into polished PNG screenshots")
    .version(dependencies.version)
    .exitOverride()
    .configureOutput({ writeOut: dependencies.stdout, writeErr: dependencies.stderr });

  program
    .command("render")
    .description("Render a source file or stdin as a PNG")
    .argument("<file>", "source file or - for stdin")
    .option("-o, --output <file>", "output PNG path")
    .option("-l, --language <language>", "syntax language")
    .option("-t, --theme <theme>", "built-in name, shared reference, or share URL", "macos")
    .option("--title <title>", "title shown in the screenshot")
    .option("--width <pixels>", "screenshot width from 420 to 1280", boundedInteger(420, 1280), 860)
    .addOption(new Option("--scale <scale>", "output scale").default(2).argParser(parseScale))
    .option("--highlight <lines>", "lines and ranges, for example 1,3-5", parseHighlightedLines, [])
    .option("--customize <key=value>", "theme customization; repeatable", collect, [])
    .action(async (file: string, options: RenderOptions) => {
      const language = options.language ?? inferLanguage(file);
      if (!language) throw new Error("Could not infer the language. Pass --language when reading stdin or an unknown extension.");
      const output = options.output ?? defaultOutput(file);
      const result = await dependencies.api.render({
        code: await dependencies.readInput(file),
        customizations: parseCustomizations(options.customize),
        highlightedLines: options.highlight,
        language,
        scale: options.scale,
        theme: options.theme,
        title: options.title ?? (file === "-" ? "" : basename(file)),
        width: options.width,
      });
      await dependencies.writePng(output, result.png);
      dependencies.stdout(`${output}\n`);
      dependencies.stderr(`Theme: ${result.theme}\n`);
    });

  program.command("capabilities").description("Show supported languages, themes, and limits").option("--json", "write JSON").action(async (options: { json?: boolean }) => {
    const capabilities = await dependencies.api.capabilities();
    dependencies.stdout(options.json ? json(capabilities) : formatCapabilities(capabilities));
  });

  program.command("themes").description("List included themes").option("--json", "write JSON").action(async (options: { json?: boolean }) => {
    const capabilities = await dependencies.api.capabilities() as { themes?: unknown };
    const themes = capabilities.themes ?? [];
    dependencies.stdout(options.json ? json(themes) : formatThemes(themes));
  });

  program.command("theme").description("Resolve a theme to an exact version").argument("<reference>", "theme name, reference, or share URL").option("--json", "write JSON").action(async (reference: string, options: { json?: boolean }) => {
    const theme = await dependencies.api.resolveTheme(reference);
    dependencies.stdout(options.json ? json(theme) : formatTheme(theme));
  });

  try {
    await program.parseAsync(args, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode;
    dependencies.stderr(`${error instanceof Error ? error.message : "Unknown error."}\n`);
    return 1;
  }
}

function boundedInteger(min: number, max: number) {
  return (value: string) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new InvalidArgumentError(`must be an integer from ${min} to ${max}`);
    }
    return number;
  };
}

function parseScale(value: string): 1 | 2 {
  if (value !== "1" && value !== "2") throw new InvalidArgumentError("must be 1 or 2");
  return Number(value) as 1 | 2;
}

function parseHighlightedLines(value: string): number[] {
  const lines = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new InvalidArgumentError("must contain positive line numbers or ranges");
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > 100_000) {
      throw new InvalidArgumentError("must contain at most 1000 ascending positive lines");
    }
    for (let line = start; line <= end; line += 1) {
      lines.add(line);
      if (lines.size > 1_000) throw new InvalidArgumentError("must contain at most 1000 ascending positive lines");
    }
  }
  return [...lines].sort((left, right) => left - right);
}

function collect(value: string, previous: string[]) {
  return [...previous, value];
}

function parseCustomizations(values: string[]): Record<string, string> {
  return Object.fromEntries(values.map((value) => {
    const separator = value.indexOf("=");
    if (separator < 1) throw new Error(`Invalid customization: ${value}. Expected key=value.`);
    return [value.slice(0, separator), value.slice(separator + 1)];
  }));
}

function inferLanguage(file: string) {
  return file === "-" ? undefined : languageByExtension[extname(file).toLowerCase()];
}

function defaultOutput(file: string) {
  if (file === "-") return "codeshot.png";
  const extension = extname(file);
  return `${basename(file, extension)}.png`;
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatThemes(value: unknown) {
  if (!Array.isArray(value)) return json(value);
  return `${value.map((theme) => typeof theme === "object" && theme && "reference" in theme ? String(theme.reference) : JSON.stringify(theme)).join("\n")}\n`;
}

function formatTheme(value: unknown) {
  return typeof value === "object" && value && "reference" in value ? `${String(value.reference)}\n` : json(value);
}

function formatCapabilities(value: unknown) {
  if (typeof value !== "object" || !value) return json(value);
  const capabilities = value as { languages?: unknown[]; themes?: unknown[]; limits?: unknown };
  return [
    `Languages: ${capabilities.languages?.length ?? 0}`,
    `Themes: ${capabilities.themes?.length ?? 0}`,
    `Limits: ${JSON.stringify(capabilities.limits ?? {})}`,
  ].join("\n") + "\n";
}
