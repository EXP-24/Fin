import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Starfield from "./components/Starfield";
import CommandPalette from "./components/CommandPalette";

export default function App() {
  return (
    <>
      <Starfield />
      <CommandPalette />
      <div className="relative z-10 font-body-lg text-body-lg text-on-background min-h-screen">
        <Sidebar />
        <div className="pl-sidebar-width flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 pt-16 flex flex-col items-center">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
