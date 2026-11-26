import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import packageInfo from "../package.json" with { type: "json" };
import { startServer } from "./app.ts";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      server.close((error) => (error ? reject(error) : resolve()));
      await promise;
    }),
  );
});

it("checks a local release once and shares the newer version and notes through presence", async () => {
  let requests = 0;
  const github = createServer((_req, res) => {
    requests++;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ tag_name: "v99.2.0", body: "Novità\n- una" }));
  });
  const listening = once(github, "listening");
  github.listen(0, "127.0.0.1");
  await listening;
  servers.push(github);
  const address = github.address();
  if (!address || typeof address === "string") throw new Error("address");
  const server = await startServer({
    port: 0,
    databaseFile: ":memory:",
    releaseSource: {
      apiUrl: `http://127.0.0.1:${address.port}/latest`,
      gitUrl: ".",
    },
  });
  servers.push(server);
  const app = server.address();
  if (!app || typeof app === "string") throw new Error("address");
  const presence = async () =>
    (
      await fetch(`http://127.0.0.1:${app.port}/api/window`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowId: "one" }),
      })
    ).json();
  await expect
    .poll(async () => (await presence()).update)
    .toEqual({
      status: "available",
      version: "99.2.0",
      notes: "Novità\n- una",
    });
  await presence();
  expect(requests).toBe(1);
});

it.each([
  ["equal", `v${packageInfo.version}`, 200],
  ["older", "v0.0.0", 200],
  ["invalid", "v999.0.0-rc.1", 200],
  ["HTTP error", "v999.0.0", 503],
])("ignores an %s release", async (_name, tag, status) => {
  const requested = Promise.withResolvers<void>();
  const github = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ tag_name: tag, body: "note" }));
    requested.resolve();
  });
  const listening = once(github, "listening");
  github.listen(0, "127.0.0.1");
  await listening;
  servers.push(github);
  const address = github.address();
  if (!address || typeof address === "string") throw new Error("address");
  const server = await startServer({
    port: 0,
    databaseFile: ":memory:",
    releaseSource: {
      apiUrl: `http://127.0.0.1:${address.port}/latest`,
      gitUrl: ".",
    },
  });
  servers.push(server);
  const app = server.address();
  if (!app || typeof app === "string") throw new Error("address");
  const base = `http://127.0.0.1:${app.port}`;
  await requested.promise;
  const response = await fetch(`${base}/api/window`, {
    method: "POST",
    body: JSON.stringify({ windowId: "one" }),
  });
  expect((await response.json()).update).toEqual({ status: "idle" });
  expect((await fetch(`${base}/api/health`)).status).toBe(200);
});

it("starts normally when the release server is unreachable", async () => {
  const github = createServer();
  const listening = once(github, "listening");
  github.listen(0, "127.0.0.1");
  await listening;
  const address = github.address();
  if (!address || typeof address === "string") throw new Error("address");
  const closed = once(github, "close");
  github.close();
  await closed;
  const server = await startServer({
    port: 0,
    databaseFile: ":memory:",
    releaseSource: {
      apiUrl: `http://127.0.0.1:${address.port}/latest`,
      gitUrl: ".",
    },
  });
  servers.push(server);
  const app = server.address();
  if (!app || typeof app === "string") throw new Error("address");
  const base = `http://127.0.0.1:${app.port}`;
  const response = await fetch(`${base}/api/window`, {
    method: "POST",
    body: JSON.stringify({ windowId: "one" }),
  });
  expect((await response.json()).update).toEqual({ status: "idle" });
  expect((await fetch(`${base}/api/health`)).status).toBe(200);
});

it.each([false, true])(
  "preserves rollback versions through presence with a newer release=%s",
  async (newer) => {
    const github = createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          tag_name: newer ? "v99.3.0" : "invalid",
          body: "note",
        }),
      );
    });
    github.listen(0, "127.0.0.1");
    await once(github, "listening");
    servers.push(github);
    const address = github.address();
    if (!address || typeof address === "string") throw new Error("address");
    const server = await startServer({
      port: 0,
      databaseFile: ":memory:",
      failedUpdate: { installed: "0.1.0", attempted: "99.2.0" },
      releaseSource: {
        apiUrl: `http://127.0.0.1:${address.port}`,
        gitUrl: ".",
      },
    });
    servers.push(server);
    const app = server.address();
    if (!app || typeof app === "string") throw new Error("address");
    await expect
      .poll(async () => {
        const response = await fetch(
          `http://127.0.0.1:${app.port}/api/window`,
          {
            method: "POST",
            body: JSON.stringify({ windowId: "one" }),
          },
        );
        return (await response.json()).update;
      })
      .toMatchObject(
        newer
          ? {
              status: "available",
              version: "99.3.0",
              failedUpdate: { installed: "0.1.0", attempted: "99.2.0" },
              failedMessage:
                "Aggiornamento non riuscito, stai usando ancora la versione 0.1.0",
            }
          : {
              status: "failed",
              failedUpdate: { installed: "0.1.0", attempted: "99.2.0" },
              message:
                "Aggiornamento non riuscito, stai usando ancora la versione 0.1.0",
            },
      );
  },
);
