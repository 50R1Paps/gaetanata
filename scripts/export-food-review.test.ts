import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("elenco esportabile per la revisione della nutrizionista", () => {
  it("esporta tutti gli alimenti con misure e dubbi e mantiene aggiornato il documento", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        fileURLToPath(new URL("./export-food-review.ts", import.meta.url)),
      ],
      { encoding: "utf8" },
    );
    expect(output).toContain(
      "| Pollo petto (crudo) | Carne bianca | — | Proposta | — |",
    );
    expect(output).toContain(
      "| Fette biscottate | Carboidrati | Fetta biscottata: 8 g | Proposta | — |",
    );
    expect(output).toContain("| Ceci | Senza categoria | — | INCERTO");
    expect(output).toContain("| Ketocal 4:1 | Senza categoria | — | INCERTO");
    const table = output.split("## Alimenti\n")[1];
    expect(
      table?.split("\n").filter((line) => line.startsWith("| ")),
    ).toHaveLength(196);
    expect(output).toBe(
      readFileSync(
        new URL("../docs/revisione-alimenti-schema.md", import.meta.url),
        "utf8",
      ),
    );
  });
});
