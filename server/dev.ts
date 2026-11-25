import { fileURLToPath } from "node:url";
import { createServer as createVite } from "vite";
import { startServer } from "./app.ts";
import { GITHUB_RELEASE_SOURCE } from "./update.ts";

// Dev mode: one process, Vite serves the frontend with hot reload, the API runs alongside.
const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5173);

const vite = await createVite({
  root,
  server: { middlewareMode: true, hmr: { port: port + 1 } },
  appType: "spa",
});

await startServer({
  port,
  databaseFile: fileURLToPath(
    new URL("../data/gaetanata-dev.db", import.meta.url),
  ),
  releaseSource: GITHUB_RELEASE_SOURCE,
  fallback: (req, res) => vite.middlewares(req, res),
});

console.log(`Gaetanata (sviluppo) su http://127.0.0.1:${port}`);
