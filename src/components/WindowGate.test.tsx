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
import { addPortion, emptyWeekPlan } from "../plan";
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
      "Gaetanata si è chiusa. Riaprila dall'icona. Nessuna bozza scritta in questa finestra.",
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

it("offers recovery only after activation, closes with the pending bozza and never cancels beforeunload", async () => {
  vi.useFakeTimers();
  let active = false;
  let reads = 0;
  let closing: { windowId: string; draft: unknown } | undefined;
  const plan = addPortion(emptyWeekPlan(), 0, 0, {
    id: "n",
    food: "Noci",
    grams: 30,
  });
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/window") return Response.json({ active });
    if (path === "/api/window/close") {
      expect(init.keepalive).toBe(true);
      closing = JSON.parse(String(init.body));
      return Response.json({ active: false });
    }
    if (path === "/api/draft") {
      reads += 1;
      return Response.json({
        patientId: null,
        plan,
        updatedAt: "2026-01-01T12:00:00Z",
      });
    }
    return Response.json({ patients: [] });
  });
  await act(async () => {
    render(
      <WindowGate presenceIntervalMs={50}>
        <App />
      </WindowGate>,
    );
  });
  expect(reads).toBe(0);
  expect(
    screen.queryByRole("region", { name: "Bozza da recuperare" }),
  ).toBeNull();
  active = true;
  await act(() => vi.advanceTimersByTimeAsync(50));
  expect(
    screen.getByRole("region", { name: "Bozza da recuperare" }),
  ).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
  });
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "55" },
  });
  const event = new Event("beforeunload", { cancelable: true });
  fireEvent(window, event);
  expect(event.defaultPrevented).toBe(false);
  fireEvent(window, new Event("pagehide"));
  expect(closing?.windowId).toBeTruthy();
  expect(closing?.draft).toEqual({
    patientId: null,
    plan: addPortion(emptyWeekPlan(), 0, 0, {
      id: "n",
      food: "Noci",
      grams: 55,
    }),
  });
});

it("reports the last successful bozza time, not the later failed write, when the server stops", async () => {
  vi.useFakeTimers();
  let offline = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/window") {
      if (offline) throw new Error("offline");
      return Response.json({ active: true });
    }
    if (path === "/api/draft") {
      if (!init.method) return new Response(null, { status: 404 });
      if (offline) throw new Error("offline");
      return Response.json({
        ...JSON.parse(String(init.body)),
        updatedAt: "2026-01-01T12:34:00Z",
      });
    }
    return Response.json({ patients: [] });
  });
  await act(async () => {
    render(
      <WindowGate presenceIntervalMs={5000}>
        <App
          initialPlan={addPortion(emptyWeekPlan(), 0, 0, {
            id: "n",
            food: "Noci",
            grams: 30,
          })}
        />
      </WindowGate>,
    );
  });
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "45" },
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  offline = true;
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "60" },
  });
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByRole("alert").textContent).toContain(
    new Date("2026-01-01T12:34:00Z").toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  expect(screen.queryByLabelText("Grammi di Noci")).toBeNull();
});

it.each(["waiting", "recovery"] as const)(
  "closes a %s window without replacing the existing bozza",
  async (state) => {
    vi.useFakeTimers();
    let closed: Record<string, unknown> | undefined;
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/window")
        return Response.json({ active: state === "recovery" });
      if (path === "/api/window/close") {
        closed = JSON.parse(String(init.body));
        return Response.json({ active: false });
      }
      if (path === "/api/draft")
        return Response.json({
          patientId: null,
          plan: emptyWeekPlan(),
          updatedAt: "2026-01-01T12:00:00Z",
        });
      return Response.json({ patients: [] });
    });
    await act(async () => {
      render(
        <WindowGate>
          <App />
        </WindowGate>,
      );
    });
    fireEvent(window, new Event("pagehide"));
    expect(closed?.windowId).toBeTruthy();
    expect(closed).not.toHaveProperty("draft");
  },
);

it("clears the closing bozza after edits return to their saved values", async () => {
  vi.useFakeTimers();
  let closed: Record<string, unknown> | undefined;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/window") return Response.json({ active: true });
    if (path === "/api/window/close") {
      closed = JSON.parse(String(init.body));
      return Response.json({ active: false });
    }
    if (path === "/api/draft") {
      if (!init.method) return new Response(null, { status: 404 });
      return init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({
            ...JSON.parse(String(init.body)),
            updatedAt: "2026-01-01T12:00:00Z",
          });
    }
    return Response.json({ patients: [] });
  });
  await act(async () => {
    render(
      <WindowGate>
        <App
          initialPlan={addPortion(emptyWeekPlan(), 0, 0, {
            id: "n",
            food: "Noci",
            grams: 30,
          })}
        />
      </WindowGate>,
    );
  });
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "45" },
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "30" },
  });
  fireEvent(window, new Event("pagehide"));
  expect(closed?.draft).toBeNull();
});
