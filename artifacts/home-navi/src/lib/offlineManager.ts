import { enqueue, getQueue, removeFromQueue, queueCount } from "./offlineQueue";

type QueueCountListener = (count: number) => void;
const listeners = new Set<QueueCountListener>();

export function addQueueListener(fn: QueueCountListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners(): void {
  const c = queueCount();
  listeners.forEach((fn) => fn(c));
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasPhotoPayload(body: string): boolean {
  return body.includes("data:image/");
}

function safeParseJson(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function makeSyntheticResponse(body: string): Response {
  const parsed = safeParseJson(body) ?? {};
  const syntheticId = -Date.now();
  const responseBody = JSON.stringify({ id: syntheticId, ...parsed, _offline: true });
  return new Response(responseBody, {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

let _originalFetch: typeof fetch = globalThis.fetch;
let _isSyncing = false;

export function installOfflineFetch(): void {
  _originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    const isApiMutation =
      (url.startsWith("/api/") || url.includes("/api/")) &&
      MUTATION_METHODS.has(method);

    if (!isApiMutation) {
      return _originalFetch(input, init);
    }

    const body = typeof init?.body === "string" ? init.body : null;

    if (!navigator.onLine && body) {
      if (hasPhotoPayload(body)) {
        throw new TypeError("offline-photo");
      }
      enqueue(url, method, body);
      notifyListeners();
      return makeSyntheticResponse(body);
    }

    try {
      return await _originalFetch(input, init);
    } catch (err) {
      if (err instanceof TypeError && body && !hasPhotoPayload(body)) {
        enqueue(url, method, body);
        notifyListeners();
        return makeSyntheticResponse(body);
      }
      throw err;
    }
  };

  window.addEventListener("online", () => {
    syncOfflineQueue();
  });
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (_isSyncing) return { synced: 0, failed: 0 };
  _isSyncing = true;

  const items = getQueue();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await _originalFetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: item.body,
      });

      if (res.ok || res.status === 201 || res.status === 200) {
        removeFromQueue(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break;
    }
  }

  _isSyncing = false;
  notifyListeners();

  return { synced, failed };
}
