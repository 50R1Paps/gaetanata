import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Schema changes, applied in order. Never edit or reorder a shipped entry:
 * append a new one. `PRAGMA user_version` stores how many have been applied.
 */
export const migrations: readonly string[] = [
  // 1: patient records. AUTOINCREMENT so a deleted patient's id is never reused.
  `CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (trim(name) <> ''),
    birth_date TEXT,
    sex TEXT CHECK (sex IN ('male', 'female')),
    weight_kg REAL CHECK (weight_kg > 0),
    height_cm REAL CHECK (height_cm > 0)
  );`,
  // 2: one current weekly plan per patient; deleting the record deletes its plan.
  `CREATE TABLE plans (
    patient_id INTEGER PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
    plan_json TEXT NOT NULL
  );`,
];

export function openDatabase(
  file: string,
  steps: readonly string[] = migrations,
): DatabaseSync {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    migrate(db, steps);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  return row?.user_version ?? 0;
}

function migrate(db: DatabaseSync, steps: readonly string[]): void {
  const current = schemaVersion(db);
  if (current > steps.length) {
    throw new Error(
      `Il database è alla versione ${current}, questa versione dell'app conosce solo fino alla ${steps.length}. Aggiorna l'app (git pull).`,
    );
  }
  for (let version = current; version < steps.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(steps[version] as string);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
