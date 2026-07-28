import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import HomePage from "./pages/HomePage.jsx";
import SessionPage from "./pages/SessionPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import ComparisonsPage from "./pages/ComparisonsPage.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/comparisons" element={<ComparisonsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
