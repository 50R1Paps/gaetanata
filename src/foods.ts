import type { Food } from "./calc";
import foodData from "./data/foods.json";

export const foods: readonly Food[] = foodData;

const foodsByName = new Map(foods.map((food) => [food.name, food]));

export function findFood(name: string): Food {
  const food = foodsByName.get(name);
  if (!food) throw new Error(`Alimento sconosciuto: ${name}`);
  return food;
}

export function defaultGrams(food: Food): number {
  return food.referenceGrams ?? 100;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const searchable = foods.map((food) => ({ food, text: normalize(food.name) }));

/** Foods containing every word of the query (case and accent insensitive),
 * names starting with the query first. */
export function searchFoods(query: string): Food[] {
  const normalized = normalize(query).trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const matches = searchable.filter(({ text }) =>
    words.every((word) => text.includes(word)),
  );
  return [
    ...matches.filter(({ text }) => text.startsWith(normalized)),
    ...matches.filter(({ text }) => !text.startsWith(normalized)),
  ].map(({ food }) => food);
}
