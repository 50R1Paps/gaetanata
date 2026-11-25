import type { IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import type { WeekPlan } from "../src/plan.ts";
import { readBody } from "./request-body.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural validation only: obsolete food names remain editable. */
export function validPlan(value: unknown): value is WeekPlan {
  return (
    record(value) &&
    Array.isArray(value.days) &&
    value.days.length === 7 &&
    value.days.every((day: unknown) => {
      if (
        !record(day) ||
        typeof day.included !== "boolean" ||
        !Array.isArray(day.meals) ||
        day.meals.length !== 6
      )
        return false;
      return day.meals.every((meal: unknown) => {
        if (!Array.isArray(meal)) return false;
        const ids = new Set<string>();
        return meal.every((portion: unknown) => {
          if (
            !record(portion) ||
            typeof portion.id !== "string" ||
            !portion.id.trim() ||
            ids.has(portion.id) ||
            typeof portion.food !== "string" ||
            !portion.food.trim() ||
            typeof portion.grams !== "number" ||
            !Number.isFinite(portion.grams) ||
            portion.grams < 0
          )
            return false;
          ids.add(portion.id);
          return true;
        });
      });
    })
  );
}

export function planHandler(
  db: DatabaseSync,
  frozen: () => boolean = () => false,
) {
  const patient = db.prepare("SELECT id FROM patients WHERE id = ?");
  const get = db.prepare("SELECT plan_json FROM plans WHERE patient_id = ?");
  const put = db.prepare(
    "INSERT INTO plans (patient_id, plan_json) VALUES (?, ?) ON CONFLICT(patient_id) DO UPDATE SET plan_json = excluded.plan_json",
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
      const row = get.get(id) as { plan_json: string } | undefined;
      return send(
        200,
        row
          ? JSON.parse(row.plan_json)
          : {
              days: Array.from({ length: 7 }, () => ({
                included: true,
                meals: Array.from({ length: 6 }, () => []),
              })),
            },
      );
    }
    if (req.method !== "PUT")
      return send(405, { error: "Metodo non consentito" });
    const bytes = await readBody(req, res);
    if (bytes === null) return;
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString("utf8"));
    } catch {
      body = null;
    }
    if (!validPlan(body))
      return send(400, {
        error:
          "Piano non valido: servono sette giorni, sei pasti e quantità non negative.",
      });
    if (frozen()) return send(409, { error: "Aggiornamento in corso" });
    // The patient may have been deleted while the request body was arriving.
    if (!patient.get(id))
      return send(404, { error: "Scheda paziente non trovata" });
    put.run(id, JSON.stringify(body));
    send(200, body);
  };
}
