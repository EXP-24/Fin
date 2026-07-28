import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  async function handleSend() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      // Create a session named after the first few words of the prompt
      const name = prompt.split(" ").slice(0, 5).join(" ") + (prompt.split(" ").length > 5 ? "..." : "");
      const session = await api.createSession(name, "Started from chat home");
      // Ideally we would pass the initial prompt to the session page, 
      // but for now we just navigate to it.
      navigate(`/sessions/${session.id}`, { state: { initialPrompt: prompt } });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0">
      {/* Dynamic Empty State / Header Section */}
      <section className="flex flex-col items-center justify-center pt-24 pb-12 transition-all duration-700 ease-in-out" id="welcome-state">
        <div className="relative mb-12">
          {/* Decorative Background Element */}
          <div className="absolute -inset-12 bg-gradient-to-tr from-secondary-container/30 to-tertiary-fixed/20 blur-3xl rounded-full opacity-50 animate-pulse"></div>
          <div className="relative flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-primary text-[32px]">analytics</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface mb-4">
              {t("Welcome to Finsight")}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              {t("Your AI-powered financial analyst. Upload reports, compare companies, and extract precise insights instantly.")}
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter w-full mb-12">
          <div 
            onClick={() => setPrompt("Can you summarize the main points of this financial report?")}
            className="bg-surface-container p-6 rounded-2xl border border-outline-variant/30 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface mb-2">{t("Report Analysis")}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("Extract metrics and insights from financial reports like 10-Ks and earnings calls.")}</p>
          </div>

          <div 
            onClick={() => setPrompt("Compare the revenue growth and profit margins of these companies.")}
            className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/30 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">compare_arrows</span>
            </div>
            <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface mb-2">{t("Market Comparison")}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("Compare multiple companies side-by-side on key performance indicators.")}</p>
          </div>

          <div 
            onClick={() => setPrompt("What is the recommended portfolio balance given the current market trend?")}
            className="bg-surface-container p-6 rounded-2xl border border-outline-variant/30 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">pie_chart</span>
            </div>
            <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface mb-2">{t("Portfolio Advisor")}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t("Get AI recommendations for portfolio balancing based on market trends.")}</p>
          </div>
        </div>
      </section>

      {/* Input Area: Fixed to Bottom */}
      <div className="fixed bottom-0 right-0 left-sidebar-width z-30 pointer-events-none">
        <div className="max-w-chat-max-width mx-auto px-margin-desktop pb-8 pointer-events-auto">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-container/20 to-primary-container/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <form 
              className="relative flex flex-col bg-surface-container-lowest border border-outline-variant rounded-full p-2 pr-3 shadow-xl transition-all duration-300 focus-within:shadow-2xl"
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
              <div className="flex items-center gap-2">
                <button 
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant" 
                  title="Upload Report"
                  type="button"
                >
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <input 
                  className="flex-1 bg-transparent border-none outline-none px-4 font-body-lg text-body-lg text-on-surface placeholder:text-outline" 
                  placeholder={t("Ask about your documents...")}
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
                <button 
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary hover:bg-on-background transition-transform active:scale-95 ${loading || !prompt.trim() ? 'opacity-50' : ''}`}
                  type="submit"
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined">arrow_upward</span>
                  )}
                </button>
              </div>
            </form>
          </div>
          {/* Metadata / Privacy Note */}
          <p className="text-center mt-3 font-body-sm text-body-sm text-outline opacity-70">
            {t("FinAI can make mistakes. Check important financial info.")}
          </p>
        </div>
      </div>
    </div>
  );
}
