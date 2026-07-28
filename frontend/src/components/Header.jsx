import { useState, useEffect } from "react";
import { useLanguage } from "../i18n.jsx";

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  
  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    // Apply theme
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <header className="fixed top-0 right-0 left-sidebar-width h-16 bg-background/80 backdrop-blur-md z-40 flex items-center justify-between px-margin-desktop">
      <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
        <span className="cursor-pointer hover:text-on-surface">Dashboard</span>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-on-surface font-medium">{t("New Analysis")}</span>
      </div>
      <div className="flex items-center gap-4">
        {/* Language Toggle */}
        <div className="flex items-center justify-between bg-surface-container-high rounded-full p-1 relative overflow-hidden w-24">
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface-container-lowest rounded-full shadow-sm transition-all duration-300 ${lang === 'VN' ? 'left-1/2' : 'left-1'}`} 
          />
          <button 
            onClick={() => setLang('EN')}
            className={`flex-1 py-1 text-xs font-label-mono z-10 transition-colors outline-none ${lang === 'EN' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            EN
          </button>
          <button 
            onClick={() => setLang('VN')}
            className={`flex-1 py-1 text-xs font-label-mono z-10 transition-colors outline-none ${lang === 'VN' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            VN
          </button>
        </div>
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-around text-on-surface-variant bg-surface-container-high rounded-full p-1 relative overflow-hidden w-20">
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-surface-container-lowest rounded-full shadow-sm transition-all duration-300 ${theme === 'dark' ? 'left-1/2' : 'left-1'}`} 
          />
          <button 
            onClick={() => setTheme('light')}
            className={`flex-1 flex justify-center py-1 z-10 transition-colors outline-none ${theme === 'light' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[16px]">light_mode</span>
          </button>
          <button 
            onClick={() => setTheme('dark')}
            className={`flex-1 flex justify-center py-1 z-10 transition-colors outline-none ${theme === 'dark' ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[16px]">dark_mode</span>
          </button>
        </div>
      </div>
    </header>
  );
}
