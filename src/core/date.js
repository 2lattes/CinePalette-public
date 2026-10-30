/** Local-date key (YYYY-MM-DD) identifying "today" for the daily game. */
export function todayKey(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** True only when key is the immediately preceding local calendar day. */
export function isYesterday(key, now = new Date()) {
  if (!key) return false;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return key === todayKey(yesterday);
}

/** Compact countdown used after a daily attempt. */
export function untilTomorrow(now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const remaining = Math.max(0, tomorrow - now);
  return {
    hours: Math.floor(remaining / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
  };
}
