// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { reportInterfaceErrors } from "./interface-errors";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reports unhandled interface errors without page URL or patient data", async () => {
  const reports: unknown[] = [];
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (path === "/api/errors") {
      reports.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    if (path === "/api/draft") return new Response(null, { status: 404 });
    return Response.json({ patients: [] });
  });
  const dispose = reportInterfaceErrors();
  await act(async () => {
    render(<App />);
  });
  const error = new Error("Errore sintetico interfaccia");
  error.stack = "Error: Errore sintetico interfaccia\n at editor.tsx:10:2";
  await act(async () => {
    const event = new ErrorEvent("error", {
      error,
      message: error.message,
      filename: "private?patient=riservato",
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);
  });
  expect(reports).toEqual([
    {
      message: "Errore sintetico interfaccia",
      stack: "Error: Errore sintetico interfaccia\n at editor.tsx:10:2",
    },
  ]);
  dispose();
});

it("reports unhandled promise errors, excludes network failures and never retries a failed report", async () => {
  const reports: unknown[] = [];
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (path === "/api/errors") {
      reports.push(JSON.parse(String(init?.body)));
      throw new TypeError("Failed to fetch");
    }
    if (path === "/api/draft") return new Response(null, { status: 404 });
    return Response.json({ patients: [] });
  });
  const dispose = reportInterfaceErrors();
  try {
    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      for (const reason of [
        new TypeError("Failed to fetch"),
        new TypeError("Load failed"),
        new TypeError("NetworkError when attempting to fetch resource."),
        new Error("Errore asincrono sintetico"),
      ]) {
        const event = new Event("unhandledrejection", { cancelable: true });
        Object.defineProperty(event, "reason", { value: reason });
        event.preventDefault();
        window.dispatchEvent(event);
      }
      window.dispatchEvent(new Event("error"));
    });
    expect(reports).toEqual([
      {
        message: "Errore asincrono sintetico",
        stack: expect.stringContaining("interface-errors.test.tsx"),
      },
    ]);
  } finally {
    dispose();
  }
});
