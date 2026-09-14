export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function readBoundedBody(request: Request, limit = 1_000_000) {
  if (Number(request.headers.get("content-length")) > limit) throw new RequestError("Dashboard data is too large", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new RequestError("Dashboard data is too large", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export function requireWriteRevision(raw: string) {
  const body = JSON.parse(raw);
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0) {
    throw new RequestError("Refresh this dashboard before saving. A household revision is required.", 409);
  }
  return body.revision as number;
}
