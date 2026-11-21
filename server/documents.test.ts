import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";
import { expect, it } from "vitest";
import { emptySchema } from "../src/schema.ts";
import { startServer } from "./app.ts";
import { buildSyntheticTemplate } from "./template-contract.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

it("stores and replaces only valid local templates across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-documents-"));
  const databaseFile = join(dir, "app.db");
  let server = await startServer({ port: 0, databaseFile });
  const call = async (method: string, body?: Buffer) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    return fetch(`http://127.0.0.1:${address.port}/api/template`, {
      method,
      body: body ? new Uint8Array(body) : null,
    });
  };
  try {
    expect(await (await call("GET")).json()).toEqual({ available: false });
    expect((await call("PUT", buildSyntheticTemplate())).status).toBe(200);
    expect(await (await call("GET")).json()).toEqual({ available: true });
    const broken = new PizZip(buildSyntheticTemplate());
    const xml = broken.file("word/document.xml")?.asText() ?? "";
    broken.file("word/document.xml", xml.replace("{nome_paziente}", "nome"));
    const rejected = await call("PUT", broken.generate({ type: "nodebuffer" }));
    expect(rejected.status).toBe(422);
    expect((await rejected.json()).error).toContain("nome_paziente");
    expect((await call("PUT", Buffer.from("not a docx"))).status).toBe(422);
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    expect(await (await call("GET")).json()).toEqual({ available: true });
    expect((await call("PUT", buildSyntheticTemplate())).status).toBe(200);
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});

it("generates schema values and conditional blocks, refusing incomplete inputs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-generation-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const json = (method: string, path: string, body: unknown) =>
    fetch(base + path, { method, body: JSON.stringify(body) });
  try {
    const patient = await (
      await json("POST", "/api/patients", {
        name: "Prova / Anònima:*?",
        birthDate: "1990-01-01",
        sex: "female",
        weightKg: 60,
        heightCm: 165,
      })
    ).json();
    const path = `/api/patients/${patient.id}/document`;
    expect((await fetch(base + path, { method: "POST" })).status).toBe(422);
    await fetch(`${base}/api/template`, {
      method: "PUT",
      body: new Uint8Array(buildSyntheticTemplate()),
    });
    const incomplete = await fetch(base + path, { method: "POST" });
    expect(incomplete.status).toBe(422);
    expect((await incomplete.json()).issues).toContainEqual({
      field: "kcal",
      message: "Inserisci le kcal dieta.",
    });
    const schema = {
      ...emptySchema(),
      kcal: 1800,
      overrides: { carbohydrates: { lunch: { pasta: 87.5 } } },
      proteinWeek: {
        redMeatGrams: 100,
        days: {
          lunedi: {
            lunch: { source: "uova", exception: true },
            dinner: { source: "formaggio_fresco" },
          },
          martedi: { lunch: { source: "pesce" } },
        },
      },
      pizza: { breadGrams: 65, oilMl: 15 },
    };
    expect(
      (await json("PUT", `/api/patients/${patient.id}/schema`, schema)).status,
    ).toBe(200);
    const response = await fetch(base + path, { method: "POST" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "wordprocessingml.document",
    );
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(decodeURIComponent(disposition)).toMatch(
      /Prova _ Anònima___ \d{4}-\d{2}-\d{2}\.docx/,
    );
    const zip = new PizZip(Buffer.from(await response.arrayBuffer()));
    const text = zip.file("word/document.xml")?.asText() ?? "";
    for (const value of [
      "saluto=Gent.ma Sig.ra",
      "nome_paziente=Prova / Anònima:*?",
      "pranzo_pasta_g=87.5",
      "conversione_pasta_cotta_g=175",
      "conversione_riso_cotto_g=218.75",
      "lunedi_pranzo_uova_g=180",
      "lunedi_pranzo_uova_n=3",
      "lunedi_cena_formaggio_fresco_alt_stagionato_g=50",
      "martedi_pranzo_pesce_g=150",
      "pizza_pane_g=65",
      "pizza_olio_cucchiai=1.5",
      "pizza_olio_cucchiaini=3",
    ])
      expect(text).toContain(value);
    expect(text).toMatch(/data=\d{2}\/\d{2}\/\d{4}/);
    expect(text).not.toContain("mercoledi_pranzo_");
    expect(text).not.toContain("pranzo_sost_farina_mais_g=");
    expect(text).not.toContain("{");
    for (const value of [
      "pranzo_sost_pane_g=145",
      "pranzo_sost_patate_g=470",
      "pranzo_sost_pasta_mista_g=55",
      "pranzo_sost_pane_misto_g=75",
      "cena_sost_pasta_g=105",
      "cena_pane_g=145",
    ])
      expect(text).toContain(value);
    await json("PUT", `/api/patients/${patient.id}/schema`, {
      ...emptySchema(),
      kcal: 1800,
      proteinWeek: { days: { lunedi: { lunch: { source: "carne_rossa" } } } },
    });
    const noGrams = await fetch(base + path, { method: "POST" });
    expect(noGrams.status).toBe(422);
    expect((await noGrams.json()).issues).toContainEqual({
      field: "lunedi.lunch.grams",
      message: "Inserisci i grammi di carne_rossa per lunedi pranzo.",
    });
    await json("PUT", `/api/patients/${patient.id}`, {
      name: "Prova",
      birthDate: "1990-01-01",
      sex: "male",
      weightKg: 70,
      heightCm: 175,
    });
    await json("PUT", `/api/patients/${patient.id}/schema`, {
      ...emptySchema(),
      kcal: 1800,
      proteinWeek: {
        redMeatGrams: 100,
        days: {
          lunedi: { lunch: { source: "uova" }, dinner: { source: "pesce" } },
          martedi: {
            lunch: { source: "carne_bianca" },
            dinner: { source: "carne_rossa", grams: 0 },
          },
          mercoledi: {
            lunch: { source: "legumi_secchi" },
            dinner: { source: "legumi_scatola" },
          },
          giovedi: {
            lunch: { source: "formaggio_fresco" },
            dinner: { source: "formaggio_stagionato" },
          },
          venerdi: {
            lunch: { source: "affettati" },
            dinner: { source: "pesce_scatola", exception: true },
          },
        },
      },
    });
    const allSources = await fetch(base + path, { method: "POST" });
    expect(allSources.status).toBe(200);
    const allText = new PizZip(Buffer.from(await allSources.arrayBuffer()))
      .file("word/document.xml")
      ?.asText();
    for (const value of [
      "saluto=Gent.mo Sig.",
      "lunedi_pranzo_uova_n=2",
      "lunedi_cena_pesce_g=150",
      "martedi_pranzo_carne_bianca_g=130",
      "martedi_cena_carne_rossa_g=0",
      "mercoledi_pranzo_legumi_secchi_g=50",
      "mercoledi_cena_legumi_scatola_g=150",
      "giovedi_pranzo_formaggio_fresco_g=100",
      "giovedi_cena_formaggio_stagionato_g=50",
      "venerdi_pranzo_affettati_g=80",
      "venerdi_cena_pesce_scatola_g=78",
    ])
      expect(allText).toContain(value);
    await json("PUT", `/api/patients/${patient.id}`, { name: "Prova" });
    const missing = await fetch(base + path, { method: "POST" });
    expect(missing.status).toBe(422);
    expect(
      (await missing.json()).issues.map(
        (issue: { field: string }) => issue.field,
      ),
    ).toEqual(
      expect.arrayContaining(["birthDate", "sex", "weightKg", "heightCm"]),
    );
    expect(
      (await fetch(`${base}/api/patients/999/document`, { method: "POST" }))
        .status,
    ).toBe(404);
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
