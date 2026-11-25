import { readFileSync } from "node:fs";

const tag = process.argv[2];
const packageInfo = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};
if (
  !tag ||
  !/^v\d+\.\d+\.\d+$/.test(tag) ||
  tag !== `v${packageInfo.version}`
) {
  console.error(
    `Il tag ${tag ?? "mancante"} non coincide con la versione ${packageInfo.version} del package.`,
  );
  process.exitCode = 1;
}
