import { describe, expect, it } from "vitest";
import schema from "./food-schema.json";
import foods from "./foods.json";

describe("dati di riferimento dello Schema", () => {
  it("assegna esplicitamente ogni alimento senza nomi orfani o categorie sconosciute", () => {
    expect(Object.keys(schema.foods).sort()).toEqual(
      foods.map((food) => food.name).sort(),
    );
    expect(foods).toHaveLength(195);
    const categories = new Set(
      schema.categories.map((category) => category.id),
    );
    expect(categories.size).toBe(17);
    for (const assignment of Object.values(schema.foods)) {
      expect(
        assignment.categoryId === null || categories.has(assignment.categoryId),
      ).toBe(true);
      expect(typeof assignment.uncertain).toBe("boolean");
      if (assignment.categoryId === null || assignment.uncertain) {
        expect(assignment.note.trim().length).toBeGreaterThan(0);
      }
    }
    expect(schema.foods["Pollo petto (crudo)"].categoryId).toBe("carne-bianca");
    expect(schema.foods["Tonno (in scatola)"].categoryId).toBe(
      "pesce-in-scatola",
    );
    expect(schema.foods["Ketocal 4:1"].categoryId).toBeNull();
    expect(schema.foods.Ceci.uncertain).toBe(true);
  });

  it("contiene solo le sette misure del Word e riferimenti applicabili", () => {
    expect(
      schema.householdMeasures.map(({ id, quantity, unit }) => [
        id,
        quantity,
        unit,
      ]),
    ).toEqual([
      ["fetta-biscottata", 8, "g"],
      ["cucchiaio-cereali", 6, "g"],
      ["biscotto", 5, "g"],
      ["cucchiaino", 5, "ml"],
      ["cucchiaio", 10, "ml"],
      ["vasetto", 125, "g"],
      ["bicchiere", 150, "ml"],
    ]);
    const measures = new Set(schema.householdMeasures.map(({ id }) => id));
    expect(measures.size).toBe(schema.householdMeasures.length);
    for (const assignment of Object.values(schema.foods)) {
      expect(new Set(assignment.measureIds).size).toBe(
        assignment.measureIds.length,
      );
      for (const id of assignment.measureIds)
        expect(measures.has(id)).toBe(true);
    }
    expect(schema.foods["Fette biscottate"].measureIds).toEqual([
      "fetta-biscottata",
    ]);
    expect(schema.foods["Olio EVO"].measureIds).toEqual([
      "cucchiaino",
      "cucchiaio",
    ]);
    expect(schema.foods["Yogurt intero"].measureIds).toEqual(["vasetto"]);
    expect(schema.foods["Latte intero UHT"].measureIds).toEqual(["bicchiere"]);
    expect(schema.foods.Burro.measureIds).toEqual([]);
  });
});
