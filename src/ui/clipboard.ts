/**
 * Copy to the clipboard, reporting whether it actually worked.
 *
 * Must be *called* synchronously from the click handler — iOS Safari rejects
 * clipboard writes that start after an await. The call below happens before
 * the first await, so awaiting the result afterwards is fine.
 */
export async function copyText(text: string): Promise<boolean> {
  // The async Clipboard API only exists in a secure context. A phone hitting
  // http://<lan-ip> in development is not one, which is why copy works from
  // localhost and not from the LAN address. Production is HTTPS, so this is
  // the branch real players take.
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or the document lost focus. The gesture is gone by
      // now so this rarely succeeds, but it costs nothing to try.
      return copyBySelection(text);
    }
  }

  return copyBySelection(text);
}

/**
 * The pre-Clipboard-API route, for non-secure contexts.
 *
 * The textarea has to be genuinely rendered — iOS refuses to copy from a
 * hidden or zero-opacity node — so it is parked off-screen instead, and
 * `select()` is followed by an explicit range because Safari ignores the
 * former on a readonly field.
 */
function copyBySelection(text: string): boolean {
  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  // Anything under 16px makes iOS zoom the viewport on focus.
  ta.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:16px;';
  document.body.appendChild(ta);

  let copied = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(ta);
    if (selection && previous) {
      selection.removeAllRanges();
      selection.addRange(previous);
    }
  }

  return copied;
}
