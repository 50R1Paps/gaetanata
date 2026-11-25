import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

// Real launcher/build subprocess startup is slower when suites run concurrently.
it("reports setup required without installing or starting a server", () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-setup-"));
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(root, "scripts/start.ts"),
        "--check-setup",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(10);
    expect(result.stderr).toBe("");
    mkdirSync(join(root, ".aggiornamento"));
    writeFileSync(join(root, ".aggiornamento", "riavvio.json"), "{}");
    const duringRestart = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        join(root, "scripts/start.ts"),
        "--check-setup",
      ],
      { encoding: "utf8" },
    );
    expect(duringRestart.status).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

it("reuses a prepared build and detects a changed public asset", () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-setup-"));
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "public"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(join(root, "index.html"), "<html></html>");
    writeFileSync(join(root, "vite.config.ts"), "");
    // Synthetic build command; exercise the real launcher's stamp lifecycle.
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    writeFileSync(join(root, "scripts/serve.ts"), "process.exit(0)");
    const args = [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      join(root, "scripts/start.ts"),
    ];
    const options = {
      encoding: "utf8" as const,
      env: { ...process.env, PORT: "0" },
    };
    expect(spawnSync(process.execPath, args, options).status).toBe(0);
    expect(
      spawnSync(process.execPath, [...args, "--check-setup"], options).status,
    ).toBe(0);
    writeFileSync(join(root, "public/favicon.png"), "synthetic asset");
    expect(
      spawnSync(process.execPath, [...args, "--check-setup"], options).status,
    ).toBe(10);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);
