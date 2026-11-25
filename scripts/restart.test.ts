import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("relaunches the new server after exit 75 and verifies its ready version", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-restart-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("address");
  const port = address.port;
  reservation.close();
  await once(reservation, "close");
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    mkdirSync(join(root, ".aggiornamento"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(join(root, "index.html"), "");
    writeFileSync(join(root, "vite.config.ts"), "");
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    const next = `import {createServer} from "node:http";
import {watch,existsSync} from "node:fs";
const file=${JSON.stringify(join(root, ".aggiornamento", "riavvio.json"))};
const server=createServer((_req,res)=>res.end(JSON.stringify({app:"gaetanata",version:"0.2.0"})));
const watcher=watch(${JSON.stringify(join(root, ".aggiornamento"))},()=>{if(!existsSync(file)){watcher.close();server.close(()=>process.exit(0))}});
server.listen(${port},"127.0.0.1",()=>process.send?.("ready"));`;
    const first = `import {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(join(root, ".aggiornamento", "riavvio.json"))}, JSON.stringify({da:"0.1.0",a:"0.2.0",tipo:"clone",refPrecedente:"main",nodeCompleto:false}));
writeFileSync(${JSON.stringify(join(root, "scripts", "serve.ts"))}, ${JSON.stringify(next)});
process.exit(75);`;
    writeFileSync(join(root, "scripts/serve.ts"), first);
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(root, "scripts/start.ts"),
      ],
      {
        cwd: root,
        env: { ...process.env, PORT: String(port), GAETANATA_NO_BROWSER: "1" },
        stdio: "pipe",
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const [code] = await once(child, "exit");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(existsSync(join(root, ".aggiornamento", "riavvio.json"))).toBe(
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);
