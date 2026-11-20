import { describe, expect, it } from "vitest";
import {
  emptyPatientForm,
  localToday,
  parsePatientForm,
  patientToForm,
} from "./patient";

const today = "2026-11-20";

describe("patient form", () => {
  it("accepts a name alone, leaving the optional fields empty", () => {
    expect(
      parsePatientForm(
        { ...emptyPatientForm, name: " Paziente Prova " },
        today,
      ),
    ).toEqual({
      ok: true,
      value: {
        name: "Paziente Prova",
        birthDate: null,
        sex: null,
        weightKg: null,
        heightCm: null,
      },
    });
  });

  it("reads decimals typed with a comma or a dot", () => {
    const form = {
      name: "Paziente Prova",
      birthDate: today,
      sex: "male" as const,
      weightKg: "72,5",
      heightCm: " 178.0 ",
    };
    expect(parsePatientForm(form, today)).toEqual({
      ok: true,
      value: {
        name: "Paziente Prova",
        birthDate: today,
        sex: "male",
        weightKg: 72.5,
        heightCm: 178,
      },
    });
  });

  it("explains every invalid field at once", () => {
    const form = {
      name: "",
      birthDate: "2026-11-21",
      sex: "" as const,
      weightKg: "settanta",
      heightCm: "-170",
    };
    expect(parsePatientForm(form, today)).toEqual({
      ok: false,
      errors: {
        name: "Inserisci il nome.",
        birthDate: "La data di nascita non può essere nel futuro.",
        weightKg: "Il peso deve essere un numero.",
        heightCm: "L'altezza deve essere maggiore di zero.",
      },
    });
  });

  it("shows a saved patient with Italian decimals", () => {
    expect(
      patientToForm({
        name: "Paziente Prova",
        birthDate: null,
        sex: "female",
        weightKg: 61.5,
        heightCm: null,
      }),
    ).toEqual({
      name: "Paziente Prova",
      birthDate: "",
      sex: "female",
      weightKg: "61,5",
      heightCm: "",
    });
  });

  it("takes today's date from the local calendar", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
