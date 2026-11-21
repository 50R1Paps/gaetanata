import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Eseguire con npm run verify.");
let completed = 0;
for (const command of ["check", "test", "build", "smoke"]) {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const child = spawn(process.execPath, [npm, "run", command], {
    cwd: root,
    stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  let code: number;
  try {
    code = await promise;
  } catch (error) {
    console.error(error);
    code = 1;
  }
  if (code !== 0) {
    console.log(
      `Verifica: FALLITA (${command}, codice ${code}; ${completed}/4 completati).`,
    );
    process.exit(code);
  }
  completed++;
}
console.log("Verifica: OK (check, test, build, smoke). ");
