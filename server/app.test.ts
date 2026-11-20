import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { startServer } from "./app.ts";

it("serves health and the SPA without exposing files outside the static directory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-server-"));
  const staticDir = join(dir, "static");
  mkdirSync(staticDir);
  writeFileSync(join(staticDir, "index.html"), "<html>app</html>");
  writeFileSync(join(dir, "package.json"), "secret package contents");
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    staticDir,
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server address");
    const base = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({
      app: "gaetanata",
      schemaVersion: 2,
    });
    expect(
      await (await fetch(`${base}/..%2fpackage.json`)).text(),
    ).not.toContain("secret package contents");
    expect(await (await fetch(`${base}/unknown`)).text()).toBe(
      "<html>app</html>",
    );
  } finally {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.close((error) => (error ? reject(error) : resolve()));
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});
