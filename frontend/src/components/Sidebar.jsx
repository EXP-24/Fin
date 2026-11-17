import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";
import { useAuth } from "../auth.jsx";
import Logo from "./Logo.jsx";
import SidebarToggle from "./SidebarToggle.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { useToast } from "./Toast.jsx";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, t, tr } = useLanguage();
  const isMember = user?.status === "member";
  const confirm = useConfirm();
  const toast = useToast();

  const [sessions, setSessions] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const NAV = [
    { to: "/", icon: "dashboard", label: tr("Tổng quan", "Overview"), end: true },
    { to: "/reports", icon: "description", label: tr("Tài liệu", "Documents") },
    { to: "/settings", icon: "settings", label: tr("Cài đặt", "Settings") },
  ];

  // Re-fetch on path change (new session created elsewhere) AND on account change
  // (login/logout while already on "/" doesn't change the path, so without
  // user_id here the list would keep showing the previous account's sessions).
  useEffect(() => {
    api.listSessions().then(setSessions).catch((e) => {
      console.error(e);
      setError(e.message || tr("Không thể tải danh sách hội thoại.", "Could not load the conversation list."));
    });
  }, [location.pathname, user?.user_id]);

  async function handleDeleteSession(session) {
    const ok = await confirm({
      title: tr("Xóa hội thoại?", "Delete conversation?"),
      message: tr(`"${session.name || "Không có tiêu đề"}" cùng các tài liệu, số liệu và câu trả lời liên quan sẽ bị xóa vĩnh viễn.`, `"${session.name || "Untitled"}" and its documents, data and answers will be permanently deleted.`),
      confirmText: tr("Xóa", "Delete"),
      cancelText: tr("Hủy", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    setDeletingId(session.id);
    setError("");
    try {
      await api.deleteSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      toast.success(tr("Đã xóa hội thoại.", "Conversation deleted."));
      if (location.pathname === `/sessions/${session.id}`) navigate("/");
    } catch (e) {
      toast.error(e.message || "Không thể xóa hội thoại.");
      api.listSessions().then(setSessions).catch(console.error);
    } finally {
      setDeletingId(null);
    }
  }

  async function onAccount() {
    if (!isMember) { navigate("/login"); return; }
    setSessions([]); // drop this account's list immediately, before the new guest identity resolves
    try { await logout(); } catch (e) { setError(e.message); }
  }

  return (
    <aside className="sidebar-panel fixed left-0 top-0 h-screen w-sidebar-width bg-surface-container-low border-r border-outline-variant/40 flex flex-col z-50">
      <div className="h-16 flex items-center shrink-0 pr-3 max-md:pr-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="FinSight"
          className="flex-1 min-w-0 px-5 h-16 flex items-center gap-3 text-left max-md:justify-center max-md:px-0"
        >
          <Logo size={34} className="orbit-float shrink-0" />
          <span className="leading-tight max-md:hidden">
            <span className="block text-lg font-bold tracking-tight text-gradient">FinSight</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">AI Platform</span>
          </span>
        </button>
        <SidebarToggle className="max-md:hidden" />
      </div>

      <div className="px-4 pb-3 max-md:px-2">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-on-primary text-sm font-semibold"
          title={t("New Analysis")}
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="max-md:hidden">{t("New Analysis")}</span>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 px-3 max-md:px-2 py-1 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium border transition-colors max-md:justify-center max-md:px-0 ${
                isActive
                  ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_22px_-8px_rgb(var(--c-primary))]"
                  : "border-transparent text-on-surface-variant hover:bg-primary/10 hover:text-on-surface"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            <span className="max-md:hidden">{item.label}</span>
          </NavLink>
        ))}

        <div className="pt-4 max-md:hidden">
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            aria-expanded={historyExpanded}
            className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant hover:text-on-surface"
          >
            <span>{tr("Lịch sử phân tích", t("Chat History"))}</span>
            <span className={`material-symbols-outlined text-[18px] transition-transform ${historyExpanded ? "rotate-180" : ""}`}>expand_more</span>
          </button>

          {historyExpanded && (
            <div className="mt-1 space-y-0.5">
              {sessions.length === 0 ? (
                <div className="text-xs text-on-surface-variant italic px-3 py-2">{t("No previous chats.")}</div>
              ) : (
                sessions.map((s) => {
                  const active = location.pathname === `/sessions/${s.id}`;
                  return (
                    <div key={s.id} className="group flex items-center gap-1">
                      <Link
                        to={`/sessions/${s.id}`}
                        title={s.name}
                        className={`flex-1 min-w-0 flex items-center gap-2 text-sm py-2 px-3 rounded-lg truncate transition-colors ${
                          active ? "bg-surface-container-high text-on-surface font-semibold" : "text-on-surface-variant hover:bg-primary/10 hover:text-on-surface"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-primary shadow-[0_0_8px_rgb(var(--c-primary))]" : "bg-outline-variant"}`} />
                        <span className="truncate">{s.name || t("Untitled Session")}</span>
                      </Link>
                      <button
                        type="button"
                        title="Xóa hội thoại"
                        aria-label={`Xóa hội thoại ${s.name || "Không có tiêu đề"}`}
                        onClick={() => handleDeleteSession(s)}
                        disabled={deletingId === s.id}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-error hover:bg-error/10 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
          {error && <p role="alert" className="px-3 py-2 text-xs text-error">{error}</p>}
        </div>
      </nav>

      <div className="p-3 max-md:p-2 border-t border-outline-variant/40 shrink-0">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-container-high/60 max-md:justify-center max-md:p-1">
          <span className="w-9 h-9 shrink-0 rounded-full grid place-items-center text-sm font-bold text-white bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400">
            {(user?.username || "K").slice(0, 1).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0 max-md:hidden">
            <p className="text-sm font-semibold text-on-surface truncate">{user?.username || (tr("Khách", "Guest"))}</p>
            <p className="text-xs text-on-surface-variant">{isMember ? (tr("Thành viên", "Member")) : (tr("Chế độ khách", "Guest mode"))}</p>
          </div>
          <button
            type="button"
            onClick={onAccount}
            title={isMember ? t("Log out") : (tr("Đăng nhập / Đăng ký", "Log in / Sign up"))}
            aria-label={isMember ? t("Log out") : (tr("Đăng nhập / Đăng ký", "Log in / Sign up"))}
            className="w-8 h-8 shrink-0 rounded-lg grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-primary/10 max-md:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">{isMember ? "logout" : "login"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
