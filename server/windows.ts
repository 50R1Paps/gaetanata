import type { IncomingMessage, ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import type { UpdateState } from "../src/update.ts";
import { readBody } from "./request-body.ts";

/** Presence only assigns ownership; silence must never shut down the server (ADR 0008). */
export function windowHandler({
  staleAfterMs = 15_000,
  idleGraceMs = 10_000,
  onIdle,
  writeDraft,
  clearDraft,
  getUpdate,
}: {
  staleAfterMs?: number | undefined;
  idleGraceMs?: number | undefined;
  onIdle?: (() => void) | undefined;
  writeDraft: (body: unknown) => { status: number; body: unknown };
  clearDraft: () => unknown;
  getUpdate: () => UpdateState;
}) {
  let active: { windowId: string; seenAt: number } | null = null;
  const registered = new Map<string, number>();
  let pendingUpdateWindows = new Set<string>();

  function beginUpdate() {
    pendingUpdateWindows = new Set(registered.keys());
  }

  async function waitForUpdateWindows() {
    while (pendingUpdateWindows.size) {
      const now = Date.now();
      for (const id of pendingUpdateWindows) {
        const seenAt = registered.get(id);
        if (seenAt === undefined || now - seenAt > staleAfterMs)
          pendingUpdateWindows.delete(id);
      }
      if (pendingUpdateWindows.size) await delay(100);
    }
  }
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function dispose() {
    clearTimeout(idleTimer);
  }

  function updateFinished() {
    if (registered.size !== 0 || !onIdle) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      onIdle();
    }, idleGraceMs);
  }

  function isActive(windowId: string): boolean {
    return (
      active?.windowId === windowId &&
      Date.now() - active.seenAt <= staleAfterMs
    );
  }

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    close: boolean,
  ) {
    function reply(status: number, body: unknown) {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    }
    if (req.method !== "POST") {
      reply(405, { error: "Metodo non consentito" });
      return;
    }
    const bytes = await readBody(req, res);
    if (!bytes) return;
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString());
    } catch {
      reply(400, { error: "JSON non valido" });
      return;
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("windowId" in body) ||
      typeof body.windowId !== "string" ||
      !body.windowId.trim()
    ) {
      reply(400, { error: "Identificativo finestra non valido" });
      return;
    }
    const windowId = body.windowId;
    const wasRegistered = registered.has(windowId);
    const now = Date.now();
    // Expiry only cleans ownership bookkeeping on explicit events.
    // It never schedules shutdown; only the close branch below may do that.
    for (const [id, seenAt] of registered) {
      if (now - seenAt > staleAfterMs) registered.delete(id);
    }
    if (close) {
      const wasActive =
        active?.windowId === windowId || (wasRegistered && !active);
      if ("draft" in body && getUpdate().status !== "progress") {
        if (!wasActive && active && isActive(active.windowId)) {
          reply(409, { error: "Finestra non attiva" });
          return;
        }
        if (body.draft === null) {
          clearDraft();
        } else {
          const result = writeDraft(body.draft);
          if (result.status !== 200) {
            reply(result.status, result.body);
            return;
          }
        }
      }
      registered.delete(windowId);
      pendingUpdateWindows.delete(windowId);
      if (wasActive) active = null;
      if (wasActive && getUpdate().status !== "progress") updateFinished();
      reply(200, { active: false });
      return;
    }
    clearTimeout(idleTimer);
    idleTimer = undefined;
    if (getUpdate().status === "progress")
      pendingUpdateWindows.delete(windowId);
    registered.set(windowId, now);
    if (!active || !isActive(active.windowId) || active.windowId === windowId) {
      active = { windowId, seenAt: now };
    }
    reply(200, { active: isActive(windowId), update: getUpdate() });
  }

  return {
    handle,
    isActive,
    dispose,
    updateFinished,
    beginUpdate,
    waitForUpdateWindows,
  };
}
