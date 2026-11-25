import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ErrorOrigin = "server" | "interfaccia" | "aggiornamento";
export type ErrorEntry = {
  date: string;
  origin: ErrorOrigin;
  message: string;
  stack: string;
};

/** The database directory is the data directory, including custom installations. */
export function errorLog(databaseFile: string) {
  const file =
    databaseFile === ":memory:"
      ? undefined
      : join(dirname(databaseFile), "errori.json");
  let entries: ErrorEntry[] =
    file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
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
        writeFileSync(temporary, JSON.stringify(entries));
        renameSync(temporary, file);
      }
    },
    latest(count: number): ErrorEntry[] {
      const limit = Math.max(0, Math.trunc(count));
      return limit === 0 ? [] : entries.slice(-limit).reverse();
    },
  };
}
