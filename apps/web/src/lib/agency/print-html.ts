/** Échappe le texte pour une insertion sûre dans un document HTML. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Ouvre la boîte d’impression du navigateur sur un document HTML isolé (A4 / PDF). */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    const win = frame.contentWindow;
    if (win === null) {
      frame.remove();
      return;
    }
    win.addEventListener('afterprint', () => {
      frame.remove();
    });
    win.focus();
    win.print();
  });
  document.body.append(frame);
}
