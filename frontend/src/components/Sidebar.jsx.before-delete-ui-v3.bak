import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  
  const [sessions, setSessions] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  
  useEffect(() => {
    // Fetch sessions
    api.listSessions().then(setSessions).catch(console.error);
  }, [location.pathname]); // Refresh when navigating

  return (
    <aside className="fixed left-0 top-0 h-screen w-sidebar-width bg-surface-container-low flex flex-col z-50">
      <div 
        className="p-6 flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <img
          alt="Precision Finance Logo"
          className="h-8 w-auto object-contain"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTRRtNGRAY5WMbv004YBcPkKWIkKUIpCulgOAD3lMESTjv_CYG7Fly8VFTior87GSqiT3hL-pMBAE9bJNQXjS3bilVpKNlK1a3ZyDMtk_eS0s2HBKSRj3a5mei89qySgHSSOyMxpYhhdKe-mud82U6C2IrEVGr_JuUl2WX_VPxwS2-eQO4LqxuHIbN4khwU5Go7NEFcCEoUIqUlEt1zQhDcaC763yXMZ7xJ-FBohQ6kgNXknI0Z9e9VY3uNwDjbT5irEYP6yyNuTw"
        />
        <span className="font-headline-md text-headline-md text-on-surface">{t("FinAI")}</span>
      </div>

      <div className="px-4 pb-2">
        <Link 
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-mono uppercase hover:opacity-90 transition-opacity justify-center"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("New Analysis")}
        </Link>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
        {/* Chat History Accordion */}
        <div className="flex flex-col">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface group"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">history</span>
              <span>{t("Chat History")}</span>
            </div>
            <span className={`material-symbols-outlined text-[18px] transition-transform ${historyExpanded ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </button>
          
          {historyExpanded && (
            <div className="flex flex-col pl-4 pr-2 mt-1 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-xs text-on-surface-variant italic px-4 py-2">{t("No previous chats.")}</div>
              ) : (
                sessions.map(s => (
                  <Link
                    key={s.id}
                    to={`/sessions/${s.id}`}
                    className={`text-sm py-2 px-3 rounded-lg truncate transition-colors ${
                      location.pathname === `/sessions/${s.id}`
                        ? "bg-surface-container-high text-on-surface font-semibold"
                        : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                    }`}
                    title={s.name}
                  >
                    {s.name || t("Untitled Session")}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <Link
          to="/comparisons"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            location.pathname === "/comparisons"
              ? "bg-surface-container-high text-on-surface font-semibold"
              : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined">compare_arrows</span>{t("Comparisons")}
        </Link>
      </nav>

      <div className="mt-auto p-4 border-t border-outline-variant/30 flex flex-col gap-4 relative">
        {/* User Profile Menu */}
        <div className="relative">
          {menuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute bottom-full mb-2 left-0 w-full bg-surface-container-high rounded-xl shadow-lg border border-outline-variant/30 py-2 z-50 overflow-hidden transform origin-bottom animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button className="w-full px-4 py-2 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings</span>
                  {t("Settings")}
                </button>
                <div className="h-px bg-outline-variant/30 my-1"></div>
                <button className="w-full px-4 py-2 text-left font-body-sm text-body-sm text-error hover:bg-error/10 transition-colors flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  {t("Log out")}
                </button>
              </div>
            </>
          )}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-highest transition-colors outline-none"
          >
            <img
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover ring-2 ring-surface-container-high"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCW-6jct90_7PrsMxOasVk50TZPq3bLoMsaEsaCYHFfLsguRjpLQdKMV7jw2qQ9glNek-OGu_VIxh8qnsJ9TgRZhV1Op3y0fCBkwebEPUMOHk7smMNzBpoZrQcgLdAnKhDkLM5tBqXQM9BBkS__OmtNEIbivxOURLn_vcAFBrHUZOD9rjbkhLlcFpfcyKqieYQC8VXdGoJ1zRtb1uhv_Z0TyeW8OQwawBlVQVXDCApLJz12G4Y2FFhEFmzwBfQOkSrQqwLL5DWsaD0"
            />
            <div className="flex-1 flex flex-col items-start truncate">
              <span className="font-body-sm text-sm font-semibold text-on-surface truncate">Vinh Nguyen</span>
              <span className="font-body-sm text-xs text-on-surface-variant truncate">Premium User</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              more_horiz
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
