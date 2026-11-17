import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";
import Logo from "../components/Logo.jsx";

const SUGGESTED_PROMPT =
  "Hãy tóm tắt báo cáo tài chính tôi tải lên, phân tích doanh thu, lợi nhuận và dòng tiền; nêu những điểm đáng chú ý và trích dẫn nguồn từ tài liệu.";
const SUPPORTED_EXTENSIONS = /\.(pdf|md|markdown|json)$/i;

export default function HomePage() {
  const navigate = useNavigate();
  const { lang, t, tr } = useLanguage();
  const fileInputRef = useRef(null);
  const promptInputRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [retrySessionId, setRetrySessionId] = useState(null);

  function selectAnalysis() {
    setPrompt(SUGGESTED_PROMPT);
    setError("");
    promptInputRef.current?.focus();
  }

  async function handleSend() {
    const question = prompt.trim();
    if (!question || loading) return;
    if (question === SUGGESTED_PROMPT) {
      setError(
        tr("Vui lòng tải báo cáo tài chính bằng nút kẹp giấy trước khi gửi câu hỏi phân tích này.", "Please attach a financial report before submitting this analysis prompt.")
      );
      fileInputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const name = question.length > 64 ? `${question.slice(0, 64)}...` : question;
      const session = await api.createSession(name, tr("Câu hỏi tài chính từ trang chủ", "Financial question from home"));
      navigate(`/sessions/${session.id}`, { state: { initialPrompt: question } });
    } catch (e) {
      setError(e?.message || (tr("Không thể tạo phiên phân tích.", "Could not create an analysis session.")));
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || loading) return;

    const invalid = files.find((file) => !SUPPORTED_EXTENSIONS.test(file.name));
    if (invalid) {
      setError(
        tr(`Định dạng chưa được hỗ trợ: ${invalid.name}. Vui lòng chọn PDF, Markdown hoặc JSON.`, `Unsupported format: ${invalid.name}. Please select PDF, Markdown or JSON.`)
      );
      return;
    }

    setLoading(true);
    setError("");
    setRetrySessionId(null);
    let session = null;
    try {
      const name = files.length === 1
        ? `${tr("Phân tích", "Analysis")}: ${files[0].name}`
        : `${tr("Phân tích", "Analysis")}: ${files.length} ${tr("tài liệu", "documents")}`;
      session = await api.createSession(name, tr("Tài liệu tải lên từ Home", "Documents uploaded from Home"));

      for (let i = 0; i < files.length; i += 1) {
        setProgress(
          tr(`Đang tải tài liệu ${i + 1}/${files.length}: ${files[i].name}`, `Uploading document ${i + 1}/${files.length}: ${files[i].name}`)
        );
        await api.uploadDocument(session.id, files[i]);
      }

      // Keep the suggested question as editable draft, not auto-send while indexing.
      navigate(`/sessions/${session.id}`, { state: { draftPrompt: prompt.trim() } });
    } catch (e) {
      setError(e?.message || (tr("Không thể tải tài liệu lên.", "Document upload failed.")));
      if (session?.id) setRetrySessionId(session.id);
    } finally {
      setProgress("");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 pb-32">
      <section
        className="flex flex-col items-center justify-center pt-16 md:pt-24 pb-12 transition-all duration-700 ease-in-out"
        id="welcome-state"
      >
        <div className="relative mb-9 md:mb-12 w-full">
          <div className="absolute -inset-12 bg-gradient-to-tr from-secondary-container/30 to-tertiary-fixed/20 blur-3xl rounded-full opacity-50 pointer-events-none" />
          <div className="relative flex flex-col items-center text-center space-y-6">
            <Logo size={72} className="orbit-float drop-shadow-[0_0_28px_rgba(120,100,255,0.55)]" />
            <h1 className="font-display-lg text-display-lg mb-4 text-gradient">
              {tr("Chào mừng đến với FinSight", "Welcome to FinSight")}
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              {tr("Trợ lý phân tích báo cáo tài chính AI của bạn. Tải tài liệu, đặt câu hỏi và nhận kết quả có dẫn nguồn.", "Your AI financial report assistant. Upload documents, ask questions and receive source-backed insights.")}
            </p>
          </div>
        </div>

        {/* Only one action card; original colors, spacing and rounded style retained. */}
        <div className="flex justify-center w-full mb-10 md:mb-12">
          <button
            type="button"
            onClick={selectAnalysis}
            disabled={loading}
            className="w-full max-w-xl text-left bg-surface-container p-6 md:p-8 rounded-2xl border border-outline-variant/40 hover:shadow-[0_0_40px_-12px_rgb(var(--c-primary))] hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[28px]">analytics</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface mb-2">
                  {t("Report Analysis")}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {tr("Tóm tắt báo cáo, phân tích doanh thu, lợi nhuận, dòng tiền và trích dẫn số liệu từ tài liệu.", "Summarize reports, analyze revenue, profit and cash flow, with citations from your documents.")}
                </p>
                <p className="text-sm text-primary mt-3 inline-flex items-center gap-1 font-medium">
                  {tr("Chọn để điền câu hỏi gợi ý", "Select to fill an example prompt")}
                  <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                </p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant md:whitespace-nowrap">
          {tr("Để phân tích một báo cáo cụ thể, nhấn biểu tượng kẹp giấy bên dưới để tải tài liệu lên.", "To analyze a specific financial report, use the paperclip below to upload your document.")}
        </p>
      </section>

      {/* Keep the same floating, rounded input bar as the original Home. */}
      <div className="fixed bottom-0 right-0 left-sidebar-width z-30 pointer-events-none">
        <div className="max-w-chat-max-width mx-auto px-margin-desktop pb-8 pointer-events-auto">
          {error && (
            <div role="alert" className="mb-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm shadow-sm">
              {error}
              {retrySessionId && (
                <button
                  type="button"
                  className="ml-2 underline font-medium"
                  onClick={() => navigate(`/sessions/${retrySessionId}`, { state: { draftPrompt: prompt.trim() } })}
                >
                  {tr("Mở phiên đã tạo", "Open created session")}
                </button>
              )}
            </div>
          )}
          {progress && (
            <p role="status" className="text-center mb-3 text-sm text-on-surface-variant" aria-live="polite">
              {progress}
            </p>
          )}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-container/20 to-primary-container/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <form
              className="relative flex flex-col bg-surface-container-lowest border border-outline-variant rounded-full p-2 pr-3 shadow-xl transition-all duration-300 focus-within:shadow-2xl"
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.markdown,.json"
                  multiple
                  className="hidden"
                  aria-label={tr("Chọn báo cáo tài chính", "Select financial documents")}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant disabled:opacity-50"
                  title={tr("Tải tài liệu từ Home", "Upload documents from Home")}
                  aria-label={tr("Tải tài liệu từ Home", "Upload documents from Home")}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <input
                  ref={promptInputRef}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 md:px-4 font-body-lg text-body-lg text-on-surface placeholder:text-outline"
                  placeholder={t("Ask about your documents...")}
                  type="text"
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); if (error) setError(""); }}
                  disabled={loading}
                />
                <button
                  className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-primary text-on-primary hover:bg-on-background transition-transform active:scale-95 ${loading || !prompt.trim() ? "opacity-50" : ""}`}
                  type="submit"
                  title={tr("Gửi câu hỏi", "Send question")}
                  aria-label={tr("Gửi câu hỏi", "Send question")}
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
          <p className="text-center mt-3 font-body-sm text-body-sm text-outline opacity-70">
            {t("FinSight can make mistakes. Check important financial info.")}
          </p>
        </div>
      </div>
    </div>
  );
}
