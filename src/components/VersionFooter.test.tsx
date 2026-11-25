// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VersionFooter } from "./VersionFooter";
import { WindowGate } from "./WindowGate";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the server version even when another window is active", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/health")
        return Response.json({ version: "1.2.3" });
      return Response.json({ active: false });
    }),
  );
  render(
    <>
      <WindowGate>
        <p>Editor</p>
      </WindowGate>
      <VersionFooter />
    </>,
  );
  expect(await screen.findByText("Versione 1.2.3")).toBeTruthy();
  expect(await screen.findByText(/già aperta/)).toBeTruthy();
});
