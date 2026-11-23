import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { isDietSchema } from "../src/schema.ts";
import { validPlan } from "./plans.ts";
import { readBody } from "./request-body.ts";

/** A single recovery copy; never writes the patient's saved documents. */
export function draftHandler(
  db: DatabaseSync,
  isActive: (windowId: string) => boolean,
) {
  const patient = db.prepare("SELECT id FROM patients WHERE id = ?");
  const get = db.prepare(
    "SELECT patient_id, updated_at, plan_json, schema_json FROM draft WHERE id = 1",
  );
  const put = db.prepare(
    "INSERT INTO draft (id, patient_id, updated_at, plan_json, schema_json) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET patient_id = excluded.patient_id, updated_at = excluded.updated_at, plan_json = excluded.plan_json, schema_json = excluded.schema_json",
  );
  const remove = db.prepare("DELETE FROM draft");
  async function handle(req: IncomingMessage, res: ServerResponse) {
    function send(status: number, body: unknown) {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    }
    if (req.method === "GET") {
      const row = get.get() as
        | {
            patient_id: number | null;
            updated_at: string;
            plan_json: string | null;
            schema_json: string | null;
          }
        | undefined;
      if (!row) return send(404, { error: "Bozza non trovata" });
      return send(200, {
        patientId: row.patient_id,
        updatedAt: row.updated_at,
        ...(row.plan_json === null ? {} : { plan: JSON.parse(row.plan_json) }),
        ...(row.schema_json === null
          ? {}
          : { schema: JSON.parse(row.schema_json) }),
      });
    }
    if (req.method !== "PUT" && req.method !== "DELETE")
      return send(405, { error: "Metodo non consentito" });
    const bytes = await readBody(req, res);
    if (bytes === null) return;
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString("utf8"));
    } catch {
      body = null;
    }
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return send(400, { error: "Bozza non valida" });
    const value = body as Record<string, unknown>;
    if (typeof value.windowId !== "string" || !isActive(value.windowId))
      return send(409, { error: "Finestra non attiva" });
    if (req.method === "DELETE") {
      remove.run();
      res.writeHead(204).end();
      return;
    }
    const result = write(value);
    send(result.status, result.body);
  }

  function write(body: unknown): { status: number; body: unknown } {
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return { status: 400, body: { error: "Bozza non valida" } };
    const value = body as Record<string, unknown>;
    if (
      (value.patientId !== null &&
        (!Number.isSafeInteger(value.patientId) ||
          Number(value.patientId) <= 0)) ||
      (value.plan === undefined && value.schema === undefined) ||
      (value.plan !== undefined && !validPlan(value.plan)) ||
      (value.schema !== undefined && !isDietSchema(value.schema))
    )
      return {
        status: 400,
        body: {
          error: "Bozza non valida: controlla paziente, piano e schema.",
        },
      };
    if (value.patientId !== null && !patient.get(Number(value.patientId)))
      return { status: 404, body: { error: "Scheda paziente non trovata" } };
    const updatedAt = new Date().toISOString();
    put.run(
      value.patientId as number | null,
      updatedAt,
      value.plan === undefined ? null : JSON.stringify(value.plan),
      value.schema === undefined ? null : JSON.stringify(value.schema),
    );
    return {
      status: 200,
      body: {
        patientId: value.patientId,
        updatedAt,
        ...(value.plan === undefined ? {} : { plan: value.plan }),
        ...(value.schema === undefined ? {} : { schema: value.schema }),
      },
    };
  }
  return { handle, write, clear: () => remove.run() };
}
