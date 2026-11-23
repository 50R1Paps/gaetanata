import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/app.ts";

// An IPC disconnect includes abrupt launcher termination/window closure.
process.on("disconnect", () => process.exit(0));
const root = fileURLToPath(new URL("..", import.meta.url));
const server = await startServer({
  port: Number(process.env.PORT ?? 5174),
  databaseFile: join(
    process.env.GAETANATA_DATA_DIR ?? join(root, "data"),
    "gaetanata.db",
  ),
  staticDir: join(root, "dist"),
  onIdle: () => server.close(() => process.exit(0)),
});
process.send?.("ready");
