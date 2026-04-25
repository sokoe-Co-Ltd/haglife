export type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  body: string;
  timestamp: number;
  conflictKey: string | null;
};

const STORAGE_KEY = "hagulife_offline_queue";

export function getQueue(): QueuedRequest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage quota exceeded (e.g. large photos) — skip queuing
  }
}

function getConflictKey(url: string, method: string): string | null {
  if (method === "PATCH" || method === "PUT") {
    const m = url.match(/\/api\/residents\/(\d+)/);
    if (m) return `resident-${m[1]}`;
  }
  return null;
}

export function enqueue(url: string, method: string, body: string): void {
  const items = getQueue();
  const conflictKey = getConflictKey(url, method);

  const filtered = conflictKey
    ? items.filter((i) => i.conflictKey !== conflictKey)
    : items;

  filtered.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    method,
    body,
    timestamp: Date.now(),
    conflictKey,
  });

  saveQueue(filtered);
}

export function removeFromQueue(id: string): void {
  saveQueue(getQueue().filter((i) => i.id !== id));
}

export function queueCount(): number {
  return getQueue().length;
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}
