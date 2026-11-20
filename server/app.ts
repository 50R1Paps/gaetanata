import { readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { openDatabase, schemaVersion } from "./db.ts";

export const APP_ID = "gaetanata";

export type ServerOptions = {
  port: number;
  databaseFile: string;
  /** Built frontend to serve; omit when a dev middleware serves the frontend. */
  staticDir?: string;
  /** Handles non-API requests in dev mode (Vite middleware). */
  fallback?: (req: IncomingMessage, res: ServerResponse) => void;
};

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Listens on 127.0.0.1 only: patient data must never be reachable from the network. */
export async function startServer(options: ServerOptions): Promise<Server> {
  const db = openDatabase(options.databaseFile);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { app: APP_ID, schemaVersion: schemaVersion(db) });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    if (options.fallback) {
      options.fallback(req, res);
      return;
    }
    if (options.staticDir) {
      serveStatic(options.staticDir, url.pathname, res).catch((error) => {
        console.error(error);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      return;
    }
    res.writeHead(404).end();
  });
  server.on("close", () => db.close());

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.once("error", reject);
  server.listen(options.port, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
  await promise;
  return server;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": contentTypes[".json"] });
  res.end(JSON.stringify(body));
}

async function serveStatic(
  root: string,
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  const file = normalize(join(root, decodeURIComponent(pathname)));
  const inside = file === root || file.startsWith(root + sep);
  const target =
    inside && (await isFile(file)) ? file : join(root, "index.html");
  const body = await readFile(target);
  res.writeHead(200, {
    "content-type": contentTypes[extname(target)] ?? "application/octet-stream",
  });
  res.end(body);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
