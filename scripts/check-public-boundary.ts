import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
    fileURLToPath(new URL("..", import.meta.url)),
);
const staged = process.argv.includes("--staged");
function git(args: string[]): Buffer {
  const result = spawnSync("git", args, { cwd: root });
  if (result.status !== 0)
    throw new Error(result.stderr.toString() || "Git non disponibile");
  return result.stdout;
}
const files = git(["ls-files", "--cached", "-z"])
  .toString()
  .split("\0")
  .filter(Boolean);
// Linked worktrees lack the untracked list: fall back to the main checkout's copy.
const mainCheckout = dirname(
  resolve(
    root,
    git(["rev-parse", "--path-format=absolute", "--git-common-dir"])
      .toString()
      .trim(),
  ),
);
const patternsFile = [root, mainCheckout]
  .map((dir) => resolve(dir, ".private-patterns"))
  .find((file) => existsSync(file));
let privatePatterns: RegExp[] = [];
if (patternsFile) {
  privatePatterns = readFileSync(patternsFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(
      (line) =>
        new RegExp(
          `(?<![\\p{L}\\p{M}\\p{N}_])${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}\\p{N}_])`,
          "giu",
        ),
    );
} else {
  console.log("Privacy: .private-patterns assente, controllo privato saltato.");
}
let failures = 0;
function report(file: string, line: number, text: string) {
  console.error(`${file}:${line}: ${text}`);
  failures++;
}
for (const file of new Set(files)) {
  if (/\.(?:docx?|dotx|odt|pdf|xlsx|xlsm|xls|csv|db|sqlite.*)$/i.test(file)) {
    report(file, 1, "Estensione non pubblicabile");
  }
  let bytes: Buffer;
  try {
    bytes = staged
      ? git(["show", `:${file}`])
      : readFileSync(resolve(root, file));
  } catch (error) {
    if (!staged && (error as NodeJS.ErrnoException).code === "ENOENT") continue;
    throw error;
  }
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  const rules = [
    /(?:[a-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/|(?:^|[\\/])[D]ownloads(?:[\\/]|$))/gi,
    ...privatePatterns,
  ];
  if (/(?:^|[./])(?:test[s]?|spec)(?:[./]|$)|\.(?:test|spec)\./i.test(file)) {
    rules.push(/\bhomedir\s*\(/g);
  }
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    for (const rule of rules) {
      for (const match of line.matchAll(rule))
        report(file, index + 1, match[0]);
    }
  }
}
console.log(`Privacy: ${failures === 0 ? "OK" : `${failures} violazioni`}.`);
process.exitCode = failures === 0 ? 0 : 1;
