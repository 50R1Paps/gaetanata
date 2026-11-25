import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { platform, release } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import packageInfo from "../package.json" with { type: "json" };
import {
  localToday,
  type PatientInput,
  validatePatient,
} from "../src/patient.ts";
import type { UpdateState } from "../src/update.ts";
import { openDatabase, schemaVersion } from "./db.ts";
import { documentHandler } from "./documents.ts";
import { draftHandler } from "./draft.ts";
import { errorLog } from "./error-log.ts";
import { inspectClone, installClone, installZip } from "./install-update.ts";
import { type PatientStore, patientStore } from "./patients.ts";
import { planHandler } from "./plans.ts";
import { readBody } from "./request-body.ts";
import { schemaHandler } from "./schemas.ts";
import { checkRelease } from "./update.ts";
import { windowHandler } from "./windows.ts";

export const APP_ID = "gaetanata";

export type ServerOptions = {
  port: number;
  databaseFile: string;
  /** Release API and repository used for updates. */
  releaseSource?: { apiUrl: string; gitUrl: string };
  /** Time without presence before another window may become active. */
  windowStaleAfterMs?: number;
  /** Grace after explicit closure; presence silence never starts it. */
  idleGraceMs?: number;
  onIdle?: () => void;
  /** Installation directory and launcher callback; absent in development. */
  appDir?: string;
  onRestart?: () => void;
  nodeVersion?: string;
  failedUpdateVersion?: string | undefined;
  failedUpdateTarget?: string | undefined;
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
  const installation = existsSync(join(options.appDir ?? process.cwd(), ".git"))
    ? "clone"
    : "ZIP";
  const errors = errorLog(options.databaseFile);
  const recordServerError = (error: unknown) => {
    errors.record("server", error);
    console.error(error);
  };
  const patients = patientStore(db);
  const frozen = () => update.status === "progress";
  const handlePlan = planHandler(db, frozen);
  const handleSchema = schemaHandler(db, frozen);
  const handleDocument = documentHandler(options.databaseFile, db, frozen);
  const drafts = draftHandler(
    db,
    (windowId) => windows.isActive(windowId),
    frozen,
  );
  let update: UpdateState = options.failedUpdateVersion
    ? {
        status: "failed",
        message: `Aggiornamento non riuscito, stai usando ancora la versione ${options.failedUpdateVersion}`,
        from: options.failedUpdateVersion,
        ...(options.failedUpdateTarget
          ? { version: options.failedUpdateTarget }
          : {}),
      }
    : { status: "idle" };
  if (update.status === "failed")
    errors.record("aggiornamento", new Error(`${update.message}${options.failedUpdateTarget ? `; versione tentata ${options.failedUpdateTarget}` : ""}`));
  const windows = windowHandler({
    staleAfterMs: options.windowStaleAfterMs,
    idleGraceMs: options.idleGraceMs,
    onIdle: options.onIdle,
    writeDraft: drafts.write,
    clearDraft: drafts.clear,
    getUpdate: () => update,
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/report") {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Metodo non consentito" });
        return;
      }
      sendJson(res, 200, {
        version: packageInfo.version,
        system: `${platform()} ${release()}`,
        installation,
        errors: errors.latest(5),
      });
      return;
    }
    if (url.pathname === "/api/errors") {
      void (async () => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Metodo non consentito" });
          return;
        }
        const bytes = await readBody(req, res);
        if (!bytes) return;
        let body: unknown;
        try {
          body = JSON.parse(bytes.toString("utf8"));
        } catch {
          body = null;
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("message" in body) ||
          typeof body.message !== "string" ||
          !body.message.trim() ||
          ("stack" in body && typeof body.stack !== "string")
        ) {
          sendJson(res, 400, { error: "Errore interfaccia non valido" });
          return;
        }
        const error = new Error(body.message);
        error.stack = "stack" in body ? String(body.stack) : "";
        errors.record("interfaccia", error);
        res.writeHead(204).end();
      })().catch((error: unknown) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
      return;
    }
    if (
      url.pathname.startsWith("/api/") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "") &&
      url.pathname !== "/api/update" &&
      url.pathname !== "/api/window" &&
      url.pathname !== "/api/window/close" &&
      frozen()
    ) {
      sendJson(res, 409, { error: "Aggiornamento in corso" });
      return;
    }
    if (url.pathname === "/api/health") {
      sendJson(res, 200, {
        app: APP_ID,
        schemaVersion: schemaVersion(db),
        version: packageInfo.version,
      });
      return;
    }
    if (url.pathname === "/api/update") {
      void (async () => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Metodo non consentito" });
          return;
        }
        const bytes = await readBody(req, res);
        if (!bytes) return;
        let body: unknown;
        try {
          body = JSON.parse(bytes.toString("utf8"));
        } catch {
          sendJson(res, 400, { error: "Richiesta non valida" });
          return;
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("windowId" in body) ||
          typeof body.windowId !== "string" ||
          !windows.isActive(body.windowId)
        ) {
          sendJson(res, 409, { error: "Finestra non attiva" });
          return;
        }
        if (
          update.status !== "available" ||
          !options.appDir ||
          !options.onRestart ||
          !options.releaseSource
        ) {
          sendJson(res, 409, { error: "Aggiornamento non disponibile" });
          return;
        }
        const clone =
          installation === "clone" ? inspectClone(options.appDir) : null;
        if (clone && "error" in clone) {
          sendJson(res, 409, { error: clone.error });
          return;
        }
        if (!clone && !update.zipUrl) {
          sendJson(res, 409, {
            error: "Archivio della versione non disponibile",
          });
          return;
        }
        if ("draft" in body && body.draft !== undefined) {
          if (body.draft === null) drafts.clear();
          else {
            const result = drafts.write(body.draft);
            if (result.status !== 200) {
              sendJson(res, result.status, result.body);
              return;
            }
          }
        }
        const version = update.version;
        const zipUrl = update.zipUrl;
        update = {
          status: "progress",
          step: "scarico",
          from: packageInfo.version,
          version,
        };
        windows.beginUpdate();
        sendJson(res, 202, { update });
        const context = {
          root: options.appDir,
          databaseFile: options.databaseFile,
          db,
          from: packageInfo.version,
          version,
          nodeVersion: options.nodeVersion ?? process.versions.node,
          onFailure: (error: unknown) => {
            const entry = new Error(`${error instanceof Error ? error.message : "Aggiornamento non riuscito"}; versione tentata ${version}`);
            if (error instanceof Error && error.stack) entry.stack = error.stack;
            errors.record("aggiornamento", entry);
          },
          setState: (state: UpdateState) => {
            update = state;
            if (state.status === "failed") windows.updateFinished();
          },
          restart: () => {
            void windows.waitForUpdateWindows().then(options.onRestart);
          },
        };
        if (clone && "ref" in clone)
          void installClone({
            ...context,
            gitUrl: options.releaseSource.gitUrl,
            ref: clone.ref,
          });
        else void installZip({ ...context, zipUrl: zipUrl ?? "" });
      })().catch((error: unknown) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
      return;
    }
    if (url.pathname === "/api/draft") {
      if (update.status === "progress" && req.method !== "GET") {
        sendJson(res, 409, { error: "Aggiornamento in corso" });
        return;
      }
      drafts.handle(req, res).catch((error) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
      return;
    }
    if (
      url.pathname === "/api/window" ||
      url.pathname === "/api/window/close"
    ) {
      windows
        .handle(req, res, url.pathname === "/api/window/close")
        .catch((error) => {
          recordServerError(error);
          if (res.headersSent) res.end();
          else sendJson(res, 500, { error: "Errore interno del server" });
        });
      return;
    }
    if (url.pathname === "/api/template") {
      handleDocument(req, res).catch((error) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
      return;
    }
    const documentMatch =
      /^\/api\/patients\/([1-9]\d{0,15})\/(document|documents)(?:\/([1-9]\d{0,15}))?$/.exec(
        url.pathname,
      );
    if (documentMatch) {
      handleDocument(
        req,
        res,
        Number(documentMatch[1]),
        documentMatch[2] === "documents",
        documentMatch[3] === undefined ? undefined : Number(documentMatch[3]),
      ).catch((error) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
      return;
    }
    if (
      url.pathname === "/api/patients" ||
      url.pathname.startsWith("/api/patients/")
    ) {
      const match = /^\/api\/patients\/([1-9]\d{0,15})\/(plan|schema)$/.exec(
        url.pathname,
      );
      const handled = match
        ? (match[2] === "schema" ? handleSchema : handlePlan)(
            Number(match[1]),
            req,
            res,
          )
        : handlePatients(patients, url.pathname, req, res, frozen);
      handled.catch((error) => {
        recordServerError(error);
        if (res.headersSent) res.end();
        else sendJson(res, 500, { error: "Errore interno del server" });
      });
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
        recordServerError(error);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      return;
    }
    res.writeHead(404).end();
  });
  server.on("close", windows.dispose);
  server.on("close", () => db.close());

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.once("error", reject);
  server.listen(options.port, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
  await promise;
  // Observe fatal exceptions without changing Node's default crash behavior.
  process.on("uncaughtExceptionMonitor", recordServerError);
  server.once("close", () => {
    process.off("uncaughtExceptionMonitor", recordServerError);
  });
  if (options.releaseSource) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    server.once("close", () => controller.abort());
    void checkRelease(
      options.releaseSource.apiUrl,
      packageInfo.version,
      controller.signal,
    )
      .then((result) => {
        if (update.status === "failed") {
          if (result.status === "available")
            update = {
              ...result,
              failedMessage: update.message,
              ...(update.from ? { failedFrom: update.from } : {}),
              ...(update.version ? { failedVersion: update.version } : {}),
            };
        } else if (update.status === "idle") {
          update = result;
        }
      })
      .finally(() => clearTimeout(timer));
  }
  return server;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": contentTypes[".json"] });
  res.end(JSON.stringify(body));
}

const patientNotFound = { error: "Scheda paziente non trovata" };

async function handlePatients(
  patients: PatientStore,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  frozen: () => boolean,
): Promise<void> {
  if (pathname === "/api/patients") {
    if (req.method === "GET") {
      sendJson(res, 200, { patients: patients.list() });
    } else if (req.method === "POST") {
      const input = await readPatient(req, res);
      if (!input) return;
      if (frozen()) sendJson(res, 409, { error: "Aggiornamento in corso" });
      else sendJson(res, 201, patients.create(input));
    } else {
      sendJson(res, 405, { error: "Metodo non consentito" });
    }
    return;
  }

  const idText = pathname.slice("/api/patients/".length);
  const id = /^[1-9]\d{0,15}$/.test(idText) ? Number(idText) : null;
  if (id === null) {
    sendJson(res, 404, patientNotFound);
  } else if (req.method === "GET") {
    const patient = patients.get(id);
    sendJson(res, patient ? 200 : 404, patient ?? patientNotFound);
  } else if (req.method === "PUT") {
    const input = await readPatient(req, res);
    if (!input) return;
    if (frozen()) {
      sendJson(res, 409, { error: "Aggiornamento in corso" });
      return;
    }
    const patient = patients.update(id, input);
    sendJson(res, patient ? 200 : 404, patient ?? patientNotFound);
  } else if (req.method === "DELETE") {
    if (patients.delete(id)) res.writeHead(204).end();
    else sendJson(res, 404, patientNotFound);
  } else {
    sendJson(res, 405, { error: "Metodo non consentito" });
  }
}

/** Parses and validates the body; on failure answers 400 and returns null. */
async function readPatient(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<PatientInput | null> {
  const bytes = await readBody(req, res);
  if (bytes === null) return null;
  let body: unknown;
  try {
    body = JSON.parse(bytes.toString("utf8"));
  } catch {
    body = undefined;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    sendJson(res, 400, { error: "Richiesta non valida" });
    return null;
  }
  const result = validatePatient(body, localToday());
  if (result.ok) return result.value;
  sendJson(res, 400, { error: "Dati non validi", fields: result.errors });
  return null;
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
