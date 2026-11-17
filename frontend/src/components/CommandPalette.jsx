import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";
import { getTheme, resolveTheme, setTheme } from "../theme.js";

const fold = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Ctrl/⌘+K command palette: jump to pages, open a past analysis, toggle theme. */
export default function CommandPalette() {
  const navigate = useNavigate();
  const { lang, tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [sessions, setSessions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("finsight:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("finsight:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    inputRef.current?.focus();
    api.listSessions().then(setSessions).catch(() => setSessions([]));
  }, [open]);

  const items = useMemo(() => {
    const go = (path) => () => navigate(path);
    const base = [
      { id: "new", group: tr("Điều hướng", "Navigate"), icon: "add_circle", label: tr("Phân tích mới", "New analysis"), run: go("/") },
      { id: "home", group: tr("Điều hướng", "Navigate"), icon: "dashboard", label: tr("Tổng quan", "Overview"), run: go("/") },
      { id: "docs", group: tr("Điều hướng", "Navigate"), icon: "description", label: tr("Tài liệu", "Documents"), run: go("/reports") },
      { id: "set", group: tr("Điều hướng", "Navigate"), icon: "settings", label: tr("Cài đặt", "Settings"), run: go("/settings") },
      {
        id: "theme",
        group: tr("Hành động", "Actions"),
        icon: resolveTheme() === "dark" ? "light_mode" : "dark_mode",
        label: resolveTheme() === "dark" ? (tr("Chuyển sang chế độ sáng", "Switch to light mode")) : (tr("Chuyển sang chế độ tối", "Switch to dark mode")),
        run: () => setTheme(resolveTheme(getTheme()) === "dark" ? "light" : "dark"),
      },
    ];
    const past = sessions.map((s) => ({
      id: `s-${s.id}`,
      group: tr("Lịch sử phân tích", "Analyses"),
      icon: "forum",
      label: s.name || (tr("Không có tiêu đề", "Untitled")),
      hint: `${s.document_count ?? 0} ${tr("tài liệu", "docs")}`,
      run: go(`/sessions/${s.id}`),
    }));
    const q = fold(query.trim());
    return [...base, ...past].filter((item) => !q || fold(item.label).includes(q));
  }, [navigate, query, sessions, lang]);

  useEffect(() => { setIndex(0); }, [query]);

  if (!open) return null;

  function choose(item) {
    setOpen(false);
    item?.run();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[index]); }
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[14vh] px-4" role="dialog" aria-modal="true" aria-label={tr("Tìm kiếm nhanh", "Quick search")}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="dialog-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-primary/40 bg-surface-container-low/95 backdrop-blur-xl shadow-2xl shadow-black/50 glow-ring">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-outline-variant/50">
          <span className="material-symbols-outlined text-on-surface-variant">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tr("Tìm trang, hội thoại, hành động…", "Search pages, chats, actions…")}
            aria-label={tr("Tìm kiếm nhanh", "Quick search")}
            className="flex-1 bg-transparent outline-none text-on-surface placeholder:text-outline"
          />
          <kbd className="rounded border border-outline-variant/60 px-1.5 py-0.5 text-[11px] text-on-surface-variant">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-on-surface-variant">{tr("Không có kết quả phù hợp.", "No matching results.")}</li>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header && <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => choose(item)}
                  className={`w-full flex items-center gap-3 h-11 px-3 rounded-lg text-left text-sm transition-colors ${i === index ? "bg-primary/20 text-on-surface" : "text-on-surface-variant"}`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${i === index ? "text-primary" : ""}`}>{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-on-surface-variant">{item.hint}</span>}
                  {i === index && <span className="material-symbols-outlined text-[16px] text-primary">keyboard_return</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
