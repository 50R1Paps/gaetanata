import { act, configure, getConfig } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

const pending = new Set<Promise<unknown>>();
let signal: AbortSignal;

beforeEach((context) => {
  signal = context.signal;
});

async function interaction<T>(run: () => Promise<T>): Promise<T> {
  const currentSignal = signal;
  currentSignal.throwIfAborted();
  const promise = run();
  pending.add(promise);
  try {
    const result = await promise;
    currentSignal.throwIfAborted();
    return result;
  } finally {
    pending.delete(promise);
  }
}

const asyncWrapper = getConfig().asyncWrapper;
configure({
  asyncWrapper: (callback) => interaction(() => asyncWrapper(callback)),
});

/** Keep React's async act scope open until its work really finishes, even when
 * Vitest has already reported a timeout. Never continue the expired test. */
export async function asyncAct(
  callback: () => Promise<unknown>,
): Promise<void> {
  await interaction(async () => {
    await act(callback);
  });
}

// sequence.hooks: "list" runs this before file-local cleanup/unmock/timer resets.
// cleanup alone cannot close an act scope belonging to a timed-out test.
afterEach(async () => {
  while (pending.size) await Promise.allSettled(pending);
});
