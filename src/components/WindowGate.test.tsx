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
import { stubDialogs } from "./schemaTestKit";
import { WindowGate } from "./WindowGate";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("shows release notes and install button only after this window becomes active", async () => {
  vi.useFakeTimers();
  let active = false;
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/window")
      return Response.json({
        active,
        update: {
          status: "available",
          version: "2.0.0",
          notes: "Novità\n- miglioramenti",
        },
      });
    if (path === "/api/draft") return new Response(null, { status: 404 });
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
  expect(screen.queryByText("Aggiornamento disponibile: 2.0.0")).toBeNull();
  active = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByText("Aggiornamento disponibile: 2.0.0")).toBeTruthy();
  expect(screen.getByText(/miglioramenti/).textContent).toBe(
    "Novità\n- miglioramenti",
  );
  expect(
    screen.getByRole("button", { name: "Installa aggiornamento" }),
  ).toBeTruthy();
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

it.each(["delete", "discard"])(
  "forgets the bozza time after successful %s",
  async (action) => {
    vi.useFakeTimers();
    let offline = false;
    const plan = addPortion(emptyWeekPlan(), 0, 0, {
      id: "n",
      food: "Noci",
      grams: 30,
    });
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/window") {
        if (offline) throw new Error("offline");
        return Response.json({ active: true });
      }
      if (path === "/api/draft") {
        if (init.method === "DELETE")
          return new Response(null, { status: 204 });
        if (!init.method && action === "delete")
          return new Response(null, { status: 404 });
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
        <WindowGate>
          <App initialPlan={plan} />
        </WindowGate>,
      );
    });
    if (action === "discard") {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Scarta" }));
      });
    } else {
      fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
        target: { value: "45" },
      });
      await act(() => vi.advanceTimersByTimeAsync(1000));
      await act(async () => {
        fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
          target: { value: "30" },
        });
      });
    }
    offline = true;
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByRole("alert").textContent).toBe(
      "Gaetanata si è chiusa. Riaprila dall'icona. Nessuna bozza scritta in questa finestra.",
    );
  },
);

it("blocks installation for an unsaved scheda, then shows steps and reloads after restart", async () => {
  vi.useFakeTimers();
  stubDialogs();
  const reload = vi.fn();
  let version = "0.1.0";
  let offline = false;
  let installed = false;
  let step = "scarico";
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/window")
      return Response.json({
        active: true,
        update: installed
          ? { status: "progress", step, from: "0.1.0", version: "0.2.0" }
          : { status: "available", version: "0.2.0", notes: "Novità" },
      });
    if (path === "/api/update") {
      installed = true;
      return Response.json(
        {
          update: { status: "progress", step, from: "0.1.0", version: "0.2.0" },
        },
        { status: 202 },
      );
    }
    if (path === "/api/health") {
      if (offline) throw new Error("restarting");
      return Response.json({ app: "gaetanata", version });
    }
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path === "/api/template") return Response.json({ available: false });
    return Response.json({ patients: [] });
  });
  await act(async () => {
    render(
      <WindowGate presenceIntervalMs={50} reload={reload}>
        <App />
      </WindowGate>,
    );
  });
  fireEvent.click(screen.getByRole("button", { name: /Paziente:/ }));
  fireEvent.change(screen.getByLabelText("Nome (obbligatorio)"), {
    target: { value: "Paziente prova" },
  });
  const button = screen.getByRole("button", {
    name: "Installa aggiornamento",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(
    screen.getByText("Salva la scheda paziente prima di aggiornare."),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nome (obbligatorio)"), {
    target: { value: "" },
  });
  expect(button.disabled).toBe(false);
  await act(async () => {
    fireEvent.click(button);
  });
  expect(screen.getByText("Scarico…")).toBeTruthy();
  offline = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByText("Aggiornamento in corso")).toBeTruthy();
  expect(screen.queryByText(/Gaetanata si è chiusa/)).toBeNull();
  offline = false;
  step = "preparo";
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByText("Preparo l'interfaccia…")).toBeTruthy();
  version = "0.2.0";
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(reload).toHaveBeenCalledOnce();
});

it("shows an update in progress in an inactive window", async () => {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/window")
      return Response.json({
        active: false,
        update: {
          status: "progress",
          step: "installo",
          from: "0.1.0",
          version: "0.2.0",
        },
      });
    throw new Error("unexpected request");
  });
  await act(async () => {
    render(
      <WindowGate>
        <App />
      </WindowGate>,
    );
  });
  expect(screen.getByText("Aggiornamento in corso")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Installa aggiornamento" }),
  ).toBeNull();
});
