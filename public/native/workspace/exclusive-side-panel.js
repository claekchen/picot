/**
 * Exclusive side-panel toggle — opening one panel collapses the others.
 * Kept in a leaf module so WebView ESM linking does not depend on
 * NativeFileBrowser's export list.
 */
export function toggleExclusiveSidePanel(panel, otherPanels = []) {
  const willOpen = panel.classList.contains("collapsed");
  if (willOpen) {
    for (const other of otherPanels) other?.classList.add("collapsed");
  }
  panel.classList.toggle("collapsed", !willOpen);
  return willOpen;
}
