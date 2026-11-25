import type { UpdateState } from "../src/update.ts";

export const GITHUB_RELEASE_SOURCE =
  "https://api.github.com/repos/50R1Paps/gaetanata/releases/latest";

export async function checkRelease(
  source: string,
  installed: string,
  signal: AbortSignal,
): Promise<UpdateState> {
  const idle: UpdateState = { status: "idle" };
  try {
    const response = await fetch(source, {
      headers: {
        "user-agent": "gaetanata",
        accept: "application/vnd.github+json",
      },
      signal,
    });
    if (!response.ok) return idle;
    const release: unknown = await response.json();
    if (
      !release ||
      typeof release !== "object" ||
      !("tag_name" in release) ||
      typeof release.tag_name !== "string" ||
      !("body" in release) ||
      (release.body !== null && typeof release.body !== "string")
    )
      return idle;
    const latest = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(
      release.tag_name,
    );
    const current = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(
      installed,
    );
    if (!latest || !current) return idle;
    for (let i = 1; i <= 3; i++) {
      const a = BigInt(latest[i] ?? "0");
      const b = BigInt(current[i] ?? "0");
      if (a > b)
        return {
          status: "available",
          version: release.tag_name.slice(1),
          notes: release.body ?? "",
        };
      if (a < b) return idle;
    }
  } catch {
    // An unavailable or invalid release must not interrupt startup.
  }
  return idle;
}
