import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, schemaVersion } from "./db.ts";

const dirs: string[] = [];
function databaseFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-db-"));
  dirs.push(dir);
  return join(dir, "test.db");
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("database migrations", () => {
  it("applies migrations in order and does not repeat them on reopening", () => {
    const file = databaseFile();
    const steps = [
      "CREATE TABLE entries (value TEXT); INSERT INTO entries VALUES ('first');",
      "INSERT INTO entries SELECT value || '-second' FROM entries;",
    ];
    const db = openDatabase(file, steps);
    expect(schemaVersion(db)).toBe(2);
    expect(
      db.prepare("SELECT value FROM entries ORDER BY rowid").all(),
    ).toEqual([{ value: "first" }, { value: "first-second" }]);
    db.close();
    const reopened = openDatabase(file, steps);
    expect(schemaVersion(reopened)).toBe(2);
    expect(
      reopened.prepare("SELECT COUNT(*) AS count FROM entries").get(),
    ).toEqual({ count: 2 });
    reopened.close();
  });

  it("rejects a database newer than the known migrations", () => {
    const file = databaseFile();
    const db = new DatabaseSync(file);
    db.exec("PRAGMA user_version = 2");
    db.close();
    expect(() => openDatabase(file, ["SELECT 1"])).toThrow(/versione 2/);
    expect(() => openDatabase(file, ["SELECT 1"])).toThrow(/aggiornamento/i);
    expect(() => openDatabase(file, ["SELECT 1"])).not.toThrow(/git pull/i);
  });

  it("rolls back a failing migration without advancing the version", () => {
    const file = databaseFile();
    expect(() =>
      openDatabase(file, [
        "CREATE TABLE entries (value TEXT)",
        "INSERT INTO entries VALUES ('rolled back'); INSERT INTO missing VALUES (1)",
      ]),
    ).toThrow();
    const db = new DatabaseSync(file);
    expect(schemaVersion(db)).toBe(1);
    expect(db.prepare("SELECT * FROM entries").all()).toEqual([]);
    db.close();
  });
});
