/**
 * Props for a horizontally scrolling container (wide tables, code). On narrow screens the content
 * overflows; tabIndex lets keyboard users focus it and scroll with the arrow keys (WCAG 2.1.1), and the
 * label tells screen-reader users what the focused area holds.
 */
export function scrollArea(label: string, className = 'table-scroll') {
  return { className, tabIndex: 0, role: 'group', 'aria-label': label } as const;
}
