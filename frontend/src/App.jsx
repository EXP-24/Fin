import { Outlet } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { LanguageProvider } from "./i18n";

export default function App() {
  return (
    <LanguageProvider>
      <div className="bg-background font-body-lg text-body-lg text-on-background min-h-screen">
        <Sidebar />
        <div className="pl-sidebar-width flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 pt-16 flex flex-col items-center">
            <Outlet />
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}
