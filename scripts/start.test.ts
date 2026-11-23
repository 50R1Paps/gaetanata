import { expect, it } from "vitest";
import { chooseBrowser } from "./start.ts";

it.each([
  ["win32", true, true, false, "edge"],
  ["win32", false, true, false, "default"],
  ["darwin", true, true, false, "chrome"],
  ["darwin", true, false, false, "edge"],
  ["darwin", false, false, false, "default"],
  ["linux", true, true, false, "default"],
  ["win32", true, true, true, "default"],
  ["darwin", true, true, true, "default"],
  ["linux", false, false, true, "default"],
] as const)(
  "chooses %s browser with Edge=%s Chrome=%s after failure=%s: %s",
  (platform, edge, chrome, failed, expected) => {
    expect(chooseBrowser(platform, { edge, chrome }, failed)).toBe(expected);
  },
);
