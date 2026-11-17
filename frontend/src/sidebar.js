// Collapsible sidebar state, persisted in localStorage and mirrored on <html data-sidebar>.
// The layout reacts through CSS (see "Collapsible sidebar" in styles.css), so pages that
// position themselves with `left-sidebar-width` / `pl-sidebar-width` follow automatically.
import { useEffect, useState } from "react";

const KEY = "sidebar";
const EVENT = "finsight:sidebar";

const read = () => {
  try { return localStorage.getItem(KEY) === "collapsed"; } catch { return false; }
};

const apply = (collapsed) => {
  document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "open";
};

export const isSidebarCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

export function setSidebarCollapsed(collapsed) {
  try { localStorage.setItem(KEY, collapsed ? "collapsed" : "open"); } catch { /* storage unavailable */ }
  apply(collapsed);
  window.dispatchEvent(new Event(EVENT));
}

export const toggleSidebar = () => setSidebarCollapsed(!isSidebarCollapsed());

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    const value = read();
    apply(value); // before first paint, so a collapsed sidebar never flashes open
    return value;
  });
  useEffect(() => {
    const sync = () => setCollapsed(isSidebarCollapsed());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return collapsed;
}
