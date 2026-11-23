import type { IncomingMessage, ServerResponse } from "node:http";
import { readBody } from "./request-body.ts";

/** Presence only assigns ownership; silence must never shut down the server (ADR 0008). */
export function windowHandler({ staleAfterMs = 15_000 } = {}) {
  let active: { windowId: string; seenAt: number } | null = null;

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
    if (close) {
      if (active?.windowId === windowId) active = null;
      reply(200, { active: false });
      return;
    }
    if (!active || !isActive(active.windowId) || active.windowId === windowId) {
      active = { windowId, seenAt: Date.now() };
    }
    reply(200, { active: isActive(windowId) });
  }

  return { handle, isActive };
}
