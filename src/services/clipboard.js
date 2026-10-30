/**
 * Clipboard access with legacy fallback.
 * Resolves true on success, false on failure — UI decides what to show.
 */
export async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { /* fall through to legacy path */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Uses the native share sheet when available, then falls back to copying. */
export async function shareOrCopy(text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'CinéPalette', text });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
