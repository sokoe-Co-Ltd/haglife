export function isReasonEmpty(reason: string | null | undefined): boolean {
  return reason == null || reason.trim().length === 0;
}

export function displaySkipReason(reason: string | null | undefined): string {
  if (isReasonEmpty(reason)) return "理由未入力";
  return reason!.trim();
}
