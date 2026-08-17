/**
 * Must be called synchronously from the click handler — iOS Safari rejects
 * clipboard writes that happen after an await.
 */
export function copyText(text: string): boolean {
  // Only available in a secure context. Over plain http on a LAN address —
  // which is how this gets tested on a phone — it is undefined, so the
  // selection fallback below is the path that actually runs there.
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through.
  }

  return copyBySelection(text);
}

/**
 * The pre-Clipboard-API route. iOS Safari ignores `select()` on a readonly
 * textarea, so the element is made contentEditable and selected through a
 * Range, which is the combination Safari honours.
 */
function copyBySelection(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.contentEditable = 'true';
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  // Anything under 16px makes iOS zoom the viewport on focus.
  ta.style.fontSize = '16px';

  document.body.appendChild(ta);

  try {
    const range = document.createRange();
    range.selectNodeContents(ta);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    ta.setSelectionRange(0, text.length);

    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}
