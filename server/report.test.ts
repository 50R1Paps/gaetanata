import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { platform, release, tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import packageInfo from "../package.json" with { type: "json" };
import { startServer } from "./app.ts";

it.each(["clone", "ZIP"])(
  "reads technical data for a %s without window ownership",
  async (installation) => {
    const dir = mkdtempSync(join(tmpdir(), "gaetanata-report-"));
    if (installation === "clone") mkdirSync(join(dir, ".git"));
    const server = await startServer({
      port: 0,
      databaseFile: join(dir, "app.db"),
      appDir: dir,
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("address");
      const base = `http://127.0.0.1:${address.port}`;
      for (let i = 0; i < 7; i++) {
        await fetch(`${base}/api/errors`, {
          method: "POST",
          body: JSON.stringify({ message: `Errore ${i}`, stack: "frame" }),
        });
      }
      const response = await fetch(`${base}/api/report`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        version: packageInfo.version,
        system: `${platform()} ${release()}`,
        installation,
      });
      expect(
        body.errors.map((entry: { message: string }) => entry.message),
      ).toEqual(["Errore 6", "Errore 5", "Errore 4", "Errore 3", "Errore 2"]);
      expect(body.errors[0]).toMatchObject({
        origin: "interfaccia",
        stack: "frame",
        date: expect.any(String),
      });
      expect(
        (await fetch(`${base}/api/report`, { method: "POST" })).status,
      ).toBe(405);
    } finally {
      server.close();
      await once(server, "close");
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
