import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n.jsx";
import { useAuth } from "../auth.jsx";
import { getTheme, resolveTheme, setTheme } from "../theme.js";

function pageTitle(pathname, tr) {
  if (pathname.startsWith("/sessions/")) return tr("Phân tích AI", "AI Analysis");
  if (pathname.startsWith("/reports")) return tr("Tài liệu", "Documents");
  if (pathname.startsWith("/settings")) return tr("Cài đặt", "Settings");
  return tr("Tổng quan", "Overview");
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { lang, setLang, tr } = useLanguage();
  const isMember = user?.status === "member";
  const [error, setError] = useState("");
  const [theme, setThemeState] = useState(() => resolveTheme());

  useEffect(() => {
    const sync = () => setThemeState(resolveTheme(getTheme()));
    window.addEventListener("finsight:prefs", sync);
    return () => window.removeEventListener("finsight:prefs", sync);
  }, []);

  async function onAccount() {
    if (!isMember) { navigate("/login"); return; }
    try { await logout(); } catch (e) { setError(e.message); }
  }

  const ghost = "w-10 h-10 rounded-lg grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-primary/10 transition-colors";

  return (
    <header className="fixed top-0 right-0 left-sidebar-width h-16 bg-background/60 backdrop-blur-xl border-b border-outline-variant/40 z-40 flex items-center justify-between px-margin-desktop">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-on-surface-variant min-w-0">
        <span>{tr("Nền tảng", "Platform")}</span>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-semibold truncate">{pageTitle(pathname, tr)}</span>
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("finsight:palette"))}
          aria-label={tr("Tìm kiếm nhanh (Ctrl K)", "Quick search (Ctrl K)")}
          className="hidden sm:flex items-center gap-2 h-10 pl-3 pr-2 w-56 rounded-lg border border-outline-variant/50 bg-surface-container-lowest/40 text-sm text-on-surface-variant hover:border-primary/50 hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          <span className="flex-1 text-left">{tr("Tìm kiếm…", "Search…")}</span>
          <kbd className="rounded border border-outline-variant/60 px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
        </button>
        <div role="group" aria-label="Ngôn ngữ" className="flex items-center rounded-lg border border-outline-variant/50 p-0.5">
          {["VN", "EN"].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${lang === l ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? (tr("Chế độ sáng", "Light mode")) : (tr("Chế độ tối", "Dark mode"))}
          aria-label={theme === "dark" ? (tr("Chuyển sang chế độ sáng", "Switch to light mode")) : (tr("Chuyển sang chế độ tối", "Switch to dark mode"))}
          className={ghost}
        >
          <span className="material-symbols-outlined text-[20px]">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
        </button>

        <button
          type="button"
          onClick={onAccount}
          title={isMember ? (tr("Đăng xuất", "Log out")) : (tr("Đăng nhập", "Log in"))}
          aria-label={isMember ? (tr("Đăng xuất", "Log out")) : (tr("Đăng nhập", "Log in"))}
          className={ghost}
        >
          <span className="material-symbols-outlined text-[20px]">{isMember ? "logout" : "login"}</span>
        </button>
      </div>
      {error && <p role="alert" className="absolute top-16 right-3 rounded-lg bg-error-container text-on-error-container p-3 text-xs">{error}</p>}
    </header>
  );
}
