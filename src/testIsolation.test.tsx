// @vitest-environment jsdom
import { setTimeout as delay } from "node:timers/promises";
import {
  cleanup,
  fireEvent,
  getConfig,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { asyncAct as act } from "./testSetup";

function Editor() {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Testo"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

async function finishAfterTimeout(signal: AbortSignal) {
  const { promise, resolve } = Promise.withResolvers<void>();
  signal.addEventListener("abort", () => resolve(), { once: true });
  await promise;
  await delay(0);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
let continued = false;

it.fails("times out with fake timers and an open React act scope", async ({
  signal,
}) => {
  vi.useFakeTimers();
  render(<Editor />);
  await act(async () => {
    await finishAfterTimeout(signal);
    fireEvent.change(screen.getByLabelText("Testo"), {
      target: { value: "prima" },
    });
  });
  continued = true;
}, 50);

it("renders and edits after the previous test timed out", () => {
  expect(continued).toBe(false);
  expect(vi.isFakeTimers()).toBe(false);
  render(<Editor />);
  const input = screen.getByRole("textbox", { name: "Testo" });
  fireEvent.change(input, { target: { value: "dopo" } });
  expect((input as HTMLInputElement).value).toBe("dopo");
});

it.fails("times out inside the async wrapper used by user-event and findBy", async ({
  signal,
}) => {
  await getConfig().asyncWrapper(() => finishAfterTimeout(signal));
  continued = true;
}, 50);

it("does not resume an expired interaction in the next test", async () => {
  expect(continued).toBe(false);
  render(<Editor />);
  expect(await screen.findByRole("textbox", { name: "Testo" })).toBeDefined();
});
