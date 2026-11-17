import { useLanguage } from "../i18n.jsx";
import { toggleSidebar, useSidebarCollapsed } from "../sidebar.js";

// "Panel" icon: a rounded window with the sidebar divider on its left.
export default function SidebarToggle({ className = "" }) {
  const { tr } = useLanguage();
  const collapsed = useSidebarCollapsed();
  const label = collapsed ? tr("Mở thanh bên (Ctrl B)", "Open sidebar (Ctrl B)") : tr("Thu gọn thanh bên (Ctrl B)", "Collapse sidebar (Ctrl B)");
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={label}
      aria-label={label}
      aria-expanded={!collapsed}
      className={`w-10 h-10 shrink-0 rounded-lg grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-primary/10 transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9.5 4v16" />
      </svg>
    </button>
  );
}
