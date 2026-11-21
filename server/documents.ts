import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { localToday } from "../src/patient.ts";
import { type DietSchema, emptySchema } from "../src/schema.ts";
import { IncompleteDocumentError } from "./document-values.ts";
import { generateDocument } from "./generate-document.ts";
import { patientStore } from "./patients.ts";
import { readBody, templateBodyLimit } from "./request-body.ts";
import { validateTemplate } from "./template-contract.ts";

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendDocument(
  res: ServerResponse,
  bytes: Uint8Array,
  filename: string,
) {
  res.writeHead(200, {
    "content-type":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "content-disposition": `attachment; filename="schema.docx"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`)}`,
    "cache-control": "no-store",
  });
  res.end(bytes);
}

export function documentHandler(databaseFile: string, db: DatabaseSync) {
  const templateFile = join(dirname(databaseFile), "template.docx");
  const patients = patientStore(db);
  const getSchema = db.prepare(
    "SELECT schema_json FROM schemas WHERE patient_id = ?",
  );
  const insertDocument = db.prepare(
    "INSERT INTO generated_documents (patient_id, created_at, filename, schema_json, docx) VALUES (?, ?, ?, ?, ?)",
  );
  const listDocuments = db.prepare(
    "SELECT id, created_at AS date, filename FROM generated_documents WHERE patient_id = ? ORDER BY created_at DESC, id DESC",
  );
  const getDocument = db.prepare(
    "SELECT filename, docx FROM generated_documents WHERE patient_id = ? AND id = ?",
  );
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    id?: number,
    history = false,
    documentId?: number,
  ) => {
    if (id !== undefined) {
      const patient = patients.get(id);
      if (!patient)
        return send(res, 404, { error: "Scheda paziente non trovata" });
      if (history) {
        if (req.method !== "GET")
          return send(res, 405, { error: "Metodo non consentito" });
        if (documentId === undefined)
          return send(res, 200, { documents: listDocuments.all(id) });
        const document = getDocument.get(id, documentId) as
          | { filename: string; docx: Uint8Array }
          | undefined;
        if (!document)
          return send(res, 404, { error: "Documento non trovato" });
        return sendDocument(res, document.docx, document.filename);
      }
      if (documentId !== undefined)
        return send(res, 404, { error: "Documento non trovato" });
      if (req.method !== "POST")
        return send(res, 405, { error: "Metodo non consentito" });
      let template: Buffer;
      try {
        template = await readFile(templateFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return send(res, 422, {
          error: "Carica il template Word prima di generare il documento.",
        });
      }
      const row = getSchema.get(id) as { schema_json: string } | undefined;
      const schema: DietSchema = row
        ? JSON.parse(row.schema_json)
        : emptySchema();
      try {
        const { bytes, filename } = generateDocument(
          template,
          patient,
          schema,
          localToday(),
        );
        insertDocument.run(
          id,
          new Date().toISOString(),
          filename,
          JSON.stringify(schema),
          bytes,
        );
        sendDocument(res, bytes, filename);
      } catch (error) {
        if (error instanceof IncompleteDocumentError)
          return send(res, 422, { error: error.message, issues: error.issues });
        throw error;
      }
      return;
    }
    if (req.method === "GET") {
      try {
        await readFile(templateFile);
        send(res, 200, { available: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        send(res, 200, { available: false });
      }
      return;
    }
    if (req.method !== "PUT")
      return send(res, 405, { error: "Metodo non consentito" });
    const bytes = await readBody(req, res, templateBodyLimit);
    if (bytes === null) return;
    try {
      validateTemplate(bytes);
    } catch (error) {
      const detail =
        error instanceof Error && error.message.startsWith("Segnaposto")
          ? error.message
          : "Template Word non valido: carica un file .docx con i segnaposto richiesti.";
      return send(res, 422, { error: detail });
    }
    // Atomic replacement: a failed upload leaves the previous template intact.
    const temporary = `${templateFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, templateFile);
    send(res, 200, { available: true });
  };
}
