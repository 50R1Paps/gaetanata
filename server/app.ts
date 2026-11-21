import { readFile, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize, sep } from "node:path";
import {
  localToday,
  type PatientInput,
  validatePatient,
} from "../src/patient.ts";
import { openDatabase, schemaVersion } from "./db.ts";
import { documentHandler } from "./documents.ts";
import { type PatientStore, patientStore } from "./patients.ts";
import { planHandler } from "./plans.ts";
import { schemaHandler } from "./schemas.ts";

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
  const patients = patientStore(db);
  const handlePlan = planHandler(db);
  const handleSchema = schemaHandler(db);
  const handleDocument = documentHandler(options.databaseFile, db);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { app: APP_ID, schemaVersion: schemaVersion(db) });
      return;
    }
    if (url.pathname === "/api/template") {
      handleDocument(req, res).catch((error) => {
        console.error(error);
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
        console.error(error);
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
        : handlePatients(patients, url.pathname, req, res);
      handled.catch((error) => {
        console.error(error);
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

const patientNotFound = { error: "Scheda paziente non trovata" };

async function handlePatients(
  patients: PatientStore,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (pathname === "/api/patients") {
    if (req.method === "GET") {
      sendJson(res, 200, { patients: patients.list() });
    } else if (req.method === "POST") {
      const input = await readPatient(req, res);
      if (input) sendJson(res, 201, patients.create(input));
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
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
