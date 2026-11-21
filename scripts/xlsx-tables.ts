import { posix } from "node:path";
import { DOMParser, type Element } from "@xmldom/xmldom";
import PizZip from "pizzip";

export type CellValue = string | number | boolean | null;
export type Sheet = Map<number, Map<number, CellValue>>;

function elements(parent: Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", name));
}

// Only text and rich-text runs belong to the value, not phonetic annotations.
function text(element: Element | undefined): string {
  if (!element) return "";
  return Array.from(element.childNodes)
    .filter((node): node is Element => node.nodeType === 1)
    .map((child) => {
      if (child.localName === "t") return child.textContent ?? "";
      if (child.localName === "r") return text(child);
      return "";
    })
    .join("");
}

function cellValue(cell: Element, strings: string[]): CellValue {
  const type = cell.getAttribute("t");
  if (type === "e") return null;
  if (type === "inlineStr") return text(elements(cell, "is")[0]);
  const value = elements(cell, "v")[0]?.textContent;
  if (value == null || value === "") return null;
  switch (type) {
    case "s":
      return strings[Number(value)] ?? null;
    case "str":
      return value;
    case "b":
      return value === "1";
    default:
      return Number(value);
  }
}

/** Read only the requested reference tables; formulas use their cached values. */
export function readTableSheets(
  bytes: Buffer,
  names: string[],
): Map<string, Sheet> {
  const zip = new PizZip(bytes);
  function xml(path: string): Element {
    const file = zip.file(path);
    if (!file) throw new Error(`Missing XLSX entry: ${path}`);
    const root = new DOMParser().parseFromString(
      file.asText(),
      "text/xml",
    ).documentElement;
    if (!root) throw new Error(`Empty XLSX XML: ${path}`);
    return root;
  }
  const workbook = xml("xl/workbook.xml");
  const relationships = elements(
    xml("xl/_rels/workbook.xml.rels"),
    "Relationship",
  );
  const strings = zip.file("xl/sharedStrings.xml")
    ? elements(xml("xl/sharedStrings.xml"), "si").map(text)
    : [];
  const result = new Map<string, Sheet>();
  for (const name of names) {
    const sheet = elements(workbook, "sheet").find(
      (sheet) => sheet.getAttribute("name") === name,
    );
    if (!sheet) throw new Error(`Missing sheet: ${name}`);
    const relationshipId = sheet.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id",
    );
    const relationship = relationships.find(
      (rel) => rel.getAttribute("Id") === relationshipId,
    );
    const target = relationship?.getAttribute("Target");
    if (!target || relationship?.getAttribute("TargetMode") === "External")
      throw new Error(`Missing worksheet relationship: ${name}`);
    const path = posix.normalize(
      target.startsWith("/") ? target.slice(1) : posix.join("xl", target),
    );
    const rows: Sheet = new Map();
    for (const row of elements(xml(path), "row")) {
      const cells = new Map<number, CellValue>();
      for (const cell of elements(row, "c")) {
        const reference = cell.getAttribute("r") ?? "";
        let column = 0;
        for (const letter of reference.match(/^[A-Z]+/)?.[0] ?? "") {
          column = column * 26 + letter.charCodeAt(0) - 64;
        }
        if (!column) throw new Error(`Invalid cell reference: ${reference}`);
        cells.set(column, cellValue(cell, strings));
      }
      rows.set(Number(row.getAttribute("r")), cells);
    }
    result.set(name, rows);
  }
  return result;
}
