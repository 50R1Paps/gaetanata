import type { IncomingMessage, ServerResponse } from "node:http";

export const jsonBodyLimit = 1024 * 1024;
export const templateBodyLimit = 10 * 1024 * 1024;

/** Stop retaining bytes immediately; keep the socket alive long enough for 413. */
export async function readBody(
  req: IncomingMessage,
  res: ServerResponse,
  limit = jsonBodyLimit,
): Promise<Buffer | null> {
  function reject() {
    res.writeHead(413, {
      "content-type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify({ error: "Richiesta troppo grande." }));
    req.resume();
    return null;
  }
  if (Number(req.headers["content-length"]) > limit) return reject();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) return reject();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}
