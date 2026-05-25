export const GANTT_START_MIN = 6 * 60;
export const GANTT_END_MIN = 21 * 60;
export const GANTT_SPAN_MIN = GANTT_END_MIN - GANTT_START_MIN;

export function timeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function timeToPercent(hhmm: string | null | undefined): number {
  const mins = timeToMinutes(hhmm);
  if (mins == null) return 0;
  return Math.max(0, Math.min(100, ((mins - GANTT_START_MIN) / GANTT_SPAN_MIN) * 100));
}

export function hourTicks(): number[] {
  const ticks: number[] = [];
  for (let h = GANTT_START_MIN / 60; h <= GANTT_END_MIN / 60; h++) ticks.push(h);
  return ticks;
}
