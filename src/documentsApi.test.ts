import { afterEach, expect, it, vi } from "vitest";
import {
  downloadPatientDocument,
  listPatientDocuments,
} from "./documentsApi.ts";

afterEach(() => vi.unstubAllGlobals());

it("lists metadata and downloads the saved file with its Unicode filename", async () => {
  const documents = [
    { id: 7, date: "2026-11-21T09:00:00.000Z", filename: "Prova Anònima.docx" },
  ];
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ documents }))
    .mockResolvedValueOnce(
      new Response("saved bytes", {
        headers: {
          "content-disposition":
            "attachment; filename=\"schema.docx\"; filename*=UTF-8''Prova%20An%C3%B2nima.docx",
        },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await listPatientDocuments(3)).toEqual(documents);
  const download = await downloadPatientDocument(3, 7);
  expect(await download.blob.text()).toBe("saved bytes");
  expect(download.filename).toBe("Prova Anònima.docx");
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    "/api/patients/3/documents",
    "/api/patients/3/documents/7",
  ]);
});
