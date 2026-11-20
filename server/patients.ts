import type { DatabaseSync } from "node:sqlite";
import type { Patient, PatientInput } from "../src/patient.ts";

const columns =
  "id, name, birth_date AS birthDate, sex, weight_kg AS weightKg, height_cm AS heightCm";

export type PatientStore = {
  list(): Patient[];
  get(id: number): Patient | undefined;
  create(input: PatientInput): Patient;
  /** undefined when no patient has this id. */
  update(id: number, input: PatientInput): Patient | undefined;
  /** false when no patient has this id. */
  delete(id: number): boolean;
};

/** Patient records in SQLite; inputs must already be validated. */
export function patientStore(db: DatabaseSync): PatientStore {
  const list = db.prepare(
    `SELECT ${columns} FROM patients ORDER BY name COLLATE NOCASE, id`,
  );
  const get = db.prepare(`SELECT ${columns} FROM patients WHERE id = ?`);
  const insert = db.prepare(
    `INSERT INTO patients (name, birth_date, sex, weight_kg, height_cm)
     VALUES (:name, :birthDate, :sex, :weightKg, :heightCm)
     RETURNING ${columns}`,
  );
  const update = db.prepare(
    `UPDATE patients SET name = :name, birth_date = :birthDate, sex = :sex,
       weight_kg = :weightKg, height_cm = :heightCm
     WHERE id = :id
     RETURNING ${columns}`,
  );
  const remove = db.prepare("DELETE FROM patients WHERE id = ?");

  return {
    list: () => list.all() as Patient[],
    get: (id: number) => get.get(id) as Patient | undefined,
    create: (input: PatientInput) => insert.get(input) as Patient,
    update: (id: number, input: PatientInput) =>
      update.get({ ...input, id }) as Patient | undefined,
    delete: (id: number) => remove.run(id).changes > 0,
  };
}
