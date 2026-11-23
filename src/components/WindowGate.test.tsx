// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { WindowGate } from "./WindowGate";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps editors out of the waiting window and starts App normally when presence grants ownership", async () => {
  vi.useFakeTimers();
  let active = false;
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path === "/api/window") return Response.json({ active });
    if (path === "/api/template") return Response.json({ available: false });
    return Response.json({ patients: [] });
  });
  await act(async () => {
    render(
      <WindowGate presenceIntervalMs={50}>
        <App />
      </WindowGate>,
    );
  });
  expect(
    screen.getByText("Gaetanata è già aperta in un'altra finestra"),
  ).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Cerca alimento" })).toBeNull();
  active = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByRole("combobox", { name: "Cerca alimento" })).toBeTruthy();
  expect(
    screen.queryByText("Gaetanata è già aperta in un'altra finestra"),
  ).toBeNull();
});

it.each(["network", "http"])(
  "blocks all editing when an active window's next presence fails (%s)",
  async (failure) => {
    vi.useFakeTimers();
    let offline = false;
    vi.stubGlobal("fetch", async (path: string) => {
      if (path === "/api/draft") return new Response(null, { status: 404 });
      if (path === "/api/window") {
        if (offline) {
          if (failure === "network") throw new Error("offline");
          return Response.json({ error: "unavailable" }, { status: 503 });
        }
        return Response.json({ active: true });
      }
      if (path === "/api/template") return Response.json({ available: false });
      return Response.json({ patients: [] });
    });
    await act(async () => {
      render(
        <WindowGate presenceIntervalMs={50}>
          <App />
        </WindowGate>,
      );
    });
    expect(
      screen.getByRole("combobox", { name: "Cerca alimento" }),
    ).toBeTruthy();
    offline = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Gaetanata si è chiusa. Riaprila dall'icona",
    );
    expect(
      screen.queryByRole("combobox", { name: "Cerca alimento" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Salva piano" })).toBeNull();
  },
);

it("uses distinct page identities and frees the active place on pagehide so a waiting App starts", async () => {
  vi.useFakeTimers();
  let owner: string | null = null;
  const identities = new Set<string>();
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path.startsWith("/api/window")) {
      const { windowId } = JSON.parse(String(init.body));
      identities.add(windowId);
      if (path.endsWith("/close")) {
        expect(init.keepalive).toBe(true);
        if (owner === windowId) owner = null;
        return Response.json({ active: false });
      }
      owner ??= windowId;
      return Response.json({ active: owner === windowId });
    }
    if (path === "/api/template") return Response.json({ available: false });
    return Response.json({ patients: [] });
  });
  const first = render(
    <WindowGate presenceIntervalMs={50}>
      <App />
    </WindowGate>,
  );
  await act(async () => {});
  render(
    <WindowGate presenceIntervalMs={50}>
      <App />
    </WindowGate>,
  );
  await act(async () => {});
  expect(identities.size).toBe(2);
  expect(
    screen.getAllByRole("combobox", { name: "Cerca alimento" }),
  ).toHaveLength(1);
  expect(
    screen.getByText("Gaetanata è già aperta in un'altra finestra"),
  ).toBeTruthy();
  // Two simulated windows share jsdom's event target; close the first via HTTP.
  const activeId = owner;
  await fetch("/api/window/close", {
    method: "POST",
    body: JSON.stringify({ windowId: activeId }),
    keepalive: true,
  });
  first.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(
    screen.queryByText("Gaetanata è già aperta in un'altra finestra"),
  ).toBeNull();
  expect(screen.getByRole("combobox", { name: "Cerca alimento" })).toBeTruthy();
  fireEvent(window, new Event("pagehide"));
  await act(async () => {});
  expect(owner).toBeNull();
});
