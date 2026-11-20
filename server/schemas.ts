import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { emptySchema, isDietSchema } from "../src/schema.ts";

/** One current input-only Schema per patient, matching the plan HTTP contract. */
export function schemaHandler(db: DatabaseSync) {
  const patient = db.prepare("SELECT id FROM patients WHERE id = ?");
  const get = db.prepare(
    "SELECT schema_json FROM schemas WHERE patient_id = ?",
  );
  const put = db.prepare(
    "INSERT INTO schemas (patient_id, schema_json) VALUES (?, ?) ON CONFLICT(patient_id) DO UPDATE SET schema_json = excluded.schema_json",
  );
  return async (id: number, req: IncomingMessage, res: ServerResponse) => {
    function send(status: number, body: unknown) {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    }
    if (!patient.get(id))
      return send(404, { error: "Scheda paziente non trovata" });
    if (req.method === "GET") {
      const row = get.get(id) as { schema_json: string } | undefined;
      return send(200, row ? JSON.parse(row.schema_json) : emptySchema());
    }
    if (req.method !== "PUT")
      return send(405, { error: "Metodo non consentito" });
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      body = null;
    }
    if (!isDietSchema(body))
      return send(400, {
        error:
          "Schema non valido: controlla impostazioni, correzioni, fonti proteiche, pizza, colazione e spuntini.",
      });
    // Deletion may have occurred while the body was being received.
    if (!patient.get(id))
      return send(404, { error: "Scheda paziente non trovata" });
    put.run(id, JSON.stringify(body));
    send(200, body);
  };
}
