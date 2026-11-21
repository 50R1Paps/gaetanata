import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { readTableSheets } from "./xlsx-tables.ts";

function workbook(): PizZip {
  const zip = new PizZip();
  zip.file(
    "xl/workbook.xml",
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="Elenco Alimenti" sheetId="7" r:id="foods"/>
      <sheet name="MET" sheetId="2" r:id="met"/>
      <sheet name="Private" sheetId="3" r:id="private"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="met" Target="/xl/worksheets/activities.xml"/>
      <Relationship Id="foods" Target="worksheets/foods.xml"/>
      <Relationship Id="private" Target="worksheets/not-read.xml"/>
    </Relationships>`,
  );
  zip.file(
    "xl/worksheets/activities.xml",
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData><row r="3"><c r="A3" t="inlineStr"><is><t>Attività</t></is></c>
      <c r="D3"><v>3.5</v></c></row></sheetData></worksheet>`,
  );
  return zip;
}

describe("XLSX reference tables", () => {
  it("reads shared and inline rich strings, cached formulas, numbers, booleans, errors and blanks", () => {
    const zip = workbook();
    zip.file(
      "xl/sharedStrings.xml",
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <si><t>Alimenti &amp; attività</t></si>
        <si><r><t xml:space="preserve"> Riso </t></r><r><t>&lt;crudo&gt;</t></r>
          <rPh sb="0" eb="1"><t>not part of value</t></rPh></si></sst>`,
    );
    zip.file(
      "xl/worksheets/foods.xml",
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c></row>
        <row r="4">
          <c r="A4" t="s"><v>1</v></c><c r="B4"><v>1.25e2</v></c>
          <c r="C4" t="e"><v>#N/A</v></c><c r="D4"/><c r="E4"><v/></c>
          <c r="G4" t="inlineStr"><is><r><t>Pane</t></r><r><t> integrale</t></r></is></c>
          <c r="H4" t="b"><v>1</v></c><c r="I4" t="b"><v>0</v></c>
          <c r="J4"><f>B4*2</f><v>250</v></c>
          <c r="K4" t="str"><f>CONCAT(&quot;A&quot;,&quot;B&quot;)</f><v>AB</v></c>
          <c r="L4" t="e"><f>1/0</f><v>#DIV/0!</v></c>
          <c r="M4"><f>1+1</f></c><c r="N4"><v>0</v></c>
          <c r="AA4"><v>-2.5</v></c>
        </row><row r="6"/></sheetData></worksheet>`,
    );
    const sheets = readTableSheets(zip.generate({ type: "nodebuffer" }), [
      "Elenco Alimenti",
      "MET",
    ]);
    expect([...sheets.keys()]).toEqual(["Elenco Alimenti", "MET"]);
    const foods = sheets.get("Elenco Alimenti");
    expect([...(foods?.keys() ?? [])]).toEqual([1, 4, 6]);
    expect(foods?.get(1)?.get(1)).toBe("Alimenti & attività");
    expect([...(foods?.get(4) ?? [])]).toEqual([
      [1, " Riso <crudo>"],
      [2, 125],
      [3, null],
      [4, null],
      [5, null],
      [7, "Pane integrale"],
      [8, true],
      [9, false],
      [10, 250],
      [11, "AB"],
      [12, null],
      [13, null],
      [14, 0],
      [27, -2.5],
    ]);
    expect(foods?.get(4)?.get(6)).toBeUndefined();
    expect(foods?.get(6)?.size).toBe(0);
    expect([...(sheets.get("MET")?.get(3) ?? [])]).toEqual([
      [1, "Attività"],
      [4, 3.5],
    ]);
  });

  it("supports workbooks without shared strings and reports missing sheets", () => {
    const bytes = workbook().generate({ type: "nodebuffer" });
    expect(readTableSheets(bytes, ["MET"]).get("MET")?.get(3)?.get(1)).toBe(
      "Attività",
    );
    expect(() => readTableSheets(bytes, ["Missing"])).toThrow(
      "Missing sheet: Missing",
    );
  });
});
