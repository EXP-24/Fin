import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Starfield from "./components/Starfield";
import CommandPalette from "./components/CommandPalette";
import { toggleSidebar, useSidebarCollapsed } from "./sidebar.js";

export default function App() {
  useSidebarCollapsed(); // applies the saved state to <html data-sidebar> before first paint

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Starfield />
      <CommandPalette />
      <div className="relative z-10 font-body-lg text-body-lg text-on-background min-h-screen">
        <Sidebar />
        <div className="pl-sidebar-width layout-shift flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 pt-16 flex flex-col items-center">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
