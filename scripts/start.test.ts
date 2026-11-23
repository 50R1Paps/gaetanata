import { EventEmitter } from "node:events";
import type * as Fs from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const { spawn, existsSync } = vi.hoisted(() => ({
  spawn: vi.fn(),
  existsSync: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn, spawnSync: vi.fn() }));
vi.mock("node:fs", async (original) => ({
  ...(await original<typeof Fs>()),
  existsSync,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  spawn.mockReset();
  existsSync.mockReset();
});

async function reopen(
  platform: string,
  installed: string[],
  env: NodeJS.ProcessEnv = {},
) {
  const launches: { command: string; args: string[]; child: EventEmitter }[] =
    [];
  spawn.mockImplementation((command: string, args: string[]) => {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
    launches.push({ command, args, child });
    return child;
  });
  existsSync.mockImplementation((path: string) => installed.includes(path));
  vi.stubGlobal("process", {
    ...process,
    platform,
    env: { PORT: "52431", ProgramFiles: "C:/Program Files", ...env },
    exit: () => {
      throw new Error("launcher exited");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ app: "gaetanata" })),
  );
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await expect(vi.importActual("./start.ts")).rejects.toThrow(
    "launcher exited",
  );
  return { launches, log };
}

it("reopens an existing app in an Edge app window on Windows", async () => {
  const edge = join(
    "C:/Program Files",
    "Microsoft",
    "Edge",
    "Application",
    "msedge.exe",
  );
  const { launches, log } = await reopen("win32", [edge]);
  expect(launches.map(({ command, args }) => ({ command, args }))).toEqual([
    { command: edge, args: ["--app=http://127.0.0.1:52431"] },
  ]);
  expect(log).toHaveBeenCalledWith(
    "Gaetanata è già aperta: http://127.0.0.1:52431",
  );
});

it.each([
  [
    "Google Chrome",
    ["/Applications/Google Chrome.app", "/Applications/Microsoft Edge.app"],
  ],
  ["Microsoft Edge", ["/Applications/Microsoft Edge.app"]],
])("opens %s in app mode on macOS when installed", async (app, installed) => {
  const { launches } = await reopen("darwin", installed);
  expect(launches.map(({ command, args }) => ({ command, args }))).toEqual([
    {
      command: "open",
      args: [
        "-na",
        `/Applications/${app}.app`,
        "--args",
        "--app=http://127.0.0.1:52431",
      ],
    },
  ]);
});

it.each(["win32", "darwin"])(
  "falls back when the app browser fails on %s",
  async (platform) => {
    const edge = join(
      "C:/Program Files",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    );
    const { launches, log } = await reopen(platform, [
      edge,
      "/Applications/Google Chrome.app",
    ]);
    launches[0]?.child.emit("error", new Error("cannot start browser"));
    expect(
      launches.map(({ command, args }) => ({ command, args })).at(-1),
    ).toEqual(
      platform === "win32"
        ? {
            command: "cmd",
            args: ["/c", "start", "", "http://127.0.0.1:52431"],
          }
        : { command: "open", args: ["http://127.0.0.1:52431"] },
    );
    expect(launches).toHaveLength(2);
    expect(log).toHaveBeenCalledWith(
      "Gaetanata è già aperta: http://127.0.0.1:52431",
    );
  },
);

it("falls back when macOS open reports an unsuccessful exit", async () => {
  const { launches } = await reopen("darwin", [
    "/Applications/Google Chrome.app",
  ]);
  launches[0]?.child.emit("exit", 1, null);
  expect(launches).toHaveLength(2);
  expect(launches[1]?.args).toEqual(["http://127.0.0.1:52431"]);
});

it.each([
  ["win32", "cmd", ["/c", "start", "", "http://127.0.0.1:52431"]],
  ["darwin", "open", ["http://127.0.0.1:52431"]],
  ["linux", "xdg-open", ["http://127.0.0.1:52431"]],
])(
  "uses the default browser on %s without an app browser",
  async (platform, command, args) => {
    const { launches, log } = await reopen(platform, []);
    expect(launches.map(({ command, args }) => ({ command, args }))).toEqual([
      { command, args },
    ]);
    launches[0]?.child.emit("error", new Error("no default browser"));
    expect(launches).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(
      "Apri il browser su http://127.0.0.1:52431",
    );
  },
);

it("finds Edge in Program Files (x86)", async () => {
  const edge = join(
    "C:\\Program Files (x86)",
    "Microsoft",
    "Edge",
    "Application",
    "msedge.exe",
  );
  const { launches } = await reopen("win32", [edge]);
  expect(launches[0]?.command).toBe(edge);
  expect(launches[0]?.args).toEqual(["--app=http://127.0.0.1:52431"]);
});

it.each(["win32", "darwin", "linux"])(
  "honors GAETANATA_NO_BROWSER on %s",
  async (platform) => {
    const { launches, log } = await reopen(platform, [], {
      GAETANATA_NO_BROWSER: "1",
    });
    expect(launches).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Gaetanata è già aperta: http://127.0.0.1:52431",
    );
  },
);

it("does not open a fallback after a successful browser exit", async () => {
  const { launches } = await reopen("darwin", [
    "/Applications/Google Chrome.app",
  ]);
  launches[0]?.child.emit("exit", 0, null);
  expect(launches).toHaveLength(1);
});
