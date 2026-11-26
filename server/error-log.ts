import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ErrorEntry, ErrorOrigin } from "../src/report.ts";

/** The database directory is the data directory, including custom installations. */
export function errorLog(databaseFile: string) {
  const file =
    databaseFile === ":memory:"
      ? undefined
      : join(dirname(databaseFile), "errori.json");
  let entries: ErrorEntry[] = [];
  if (file) {
    try {
      const stored: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (Array.isArray(stored) && stored.every(isErrorEntry)) entries = stored;
    } catch {
      // A missing or unreadable diagnostic log must not prevent startup.
    }
  }
  return {
    record(origin: ErrorOrigin, error: unknown): void {
      const message =
        error instanceof Error ? error.message : "Errore non gestito";
      const stack = error instanceof Error ? (error.stack ?? "") : "";
      entries = [
        ...entries.slice(-49),
        {
          date: new Date().toISOString(),
          origin,
          message: message.slice(0, 1000),
          stack: stack.split("\n").slice(0, 6).join("\n").slice(0, 3000),
        },
      ];
      if (file) {
        const temporary = `${file}.tmp`;
        try {
          writeFileSync(temporary, JSON.stringify(entries));
          renameSync(temporary, file);
        } catch {
          // Diagnostics must never interrupt the operation being diagnosed.
          console.error("Impossibile salvare il registro degli errori.");
        }
      }
    },
    latest(count: number): ErrorEntry[] {
      return entries.slice(-count).reverse();
    },
  };
}

function isErrorEntry(value: unknown): value is ErrorEntry {
  return (
    value !== null &&
    typeof value === "object" &&
    "date" in value &&
    typeof value.date === "string" &&
    "origin" in value &&
    (value.origin === "server" ||
      value.origin === "interfaccia" ||
      value.origin === "aggiornamento") &&
    "message" in value &&
    typeof value.message === "string" &&
    "stack" in value &&
    typeof value.stack === "string"
  );
}
