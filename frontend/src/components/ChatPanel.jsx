import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n.jsx";
import { useAuth } from "../auth.jsx";
import Logo from "./Logo.jsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** FinSight AI avatar: the project logo (it carries its own planet shape, so no background). */
function AiAvatar({ className = "" }) {
  return <Logo size={36} className={`shrink-0 drop-shadow-[0_0_10px_rgba(120,100,255,0.45)] ${className}`} />;
}

export default function ChatPanel({ sessionId, ready, initialPrompt, draftPrompt = "", onUploadClick, documentCount = 0, hasPendingDocuments = false }) {
  const { t, lang, tr } = useLanguage();
  const { user } = useAuth();
  const isGuest = user?.status !== "member";
  const [guestNoticeHidden, setGuestNoticeHidden] = useState(() => {
    try { return localStorage.getItem("guestNoticeDismissed") === "1"; } catch { return false; }
  });
  function dismissGuestNotice() {
    setGuestNoticeHidden(true);
    try { localStorage.setItem("guestNoticeDismissed", "1"); } catch { /* storage unavailable */ }
  }
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState(() => draftPrompt);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState("");
  const processing = hasPendingDocuments;
  const canAsk = ready && !processing;
  const statusText = processing
    ? (tr("Đang xử lý tài liệu. Bạn có thể soạn câu hỏi và gửi khi hoàn tất.", "Processing documents. Draft your question while you wait."))
    : ready
      ? (tr("Tài liệu đã sẵn sàng để hỏi đáp.", "Documents are ready for questions."))
      : (tr("Tải báo cáo lên để bắt đầu hỏi đáp.", "Upload a report to start asking questions."));

  // Initialize with initialPrompt if provided
  
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timerId;

    api.getHistory(sessionId)
      .then((history) => {
        if (!active) return;

        setMessages(history);

        const prompt = initialPrompt?.trim();
        if (!prompt) return;
        setQuestion(prompt);
        if (!canAsk) return;

        // Không gửi lại câu hỏi đã có trong lịch sử
        const exists = history.some(
          (m) =>
            m.role === "user" &&
            m.content?.trim() === prompt
        );

        if (exists) return;

        timerId = setTimeout(() => {
          if (active) handleSendPrompt(prompt);
        }, 500);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [sessionId, initialPrompt, canAsk]);


  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSendPrompt(q) {
    if (!q || submittingRef.current || !canAsk) return;
    submittingRef.current = true;
    setError("");
    setFailedQuestion("");
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q, citations: [] }]);
    setSending(true);
    try {
      const res = await api.ask(sessionId, q);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, citations: res.citations },
      ]);
    } catch (err) {
      setError(err.message);
      setFailedQuestion(q);
      setQuestion(q);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  }

  function send(e) {
    e.preventDefault();
    handleSendPrompt(question.trim());
  }

  return (
    <div className="flex flex-col space-y-8 w-full relative">
      {messages.length === 0 && !sending && !initialPrompt && (
        <div className="flex items-start gap-4">
          <AiAvatar />
          <div className="bg-surface-container-high p-5 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm">
            <p className="font-body-lg text-body-lg text-on-surface">{t("I've initialized this session. Please upload your documents or type a query to begin.")}</p>
            <div className="mt-4 flex gap-2">
              <span className="text-xs text-on-surface-variant">{tr("Câu trả lời kèm nguồn từ tài liệu của bạn", "Answers grounded in your documents")}</span>
            </div>
          </div>
        </div>
      )}

      {isGuest && !guestNoticeHidden && (
        <div role="note" className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-primary mt-px">info</span>
          <p className="leading-relaxed">
            {tr("Bạn đang ở chế độ khách: lịch sử trò chuyện không được lưu và sẽ mất khi tải lại trang. ", "You're in guest mode: chat history isn't saved and is lost when you reload. ")}
            <Link to="/login" className="font-semibold text-primary underline">{tr("Đăng nhập hoặc đăng ký", "Sign in or register")}</Link>
            {tr(" để lưu các cuộc trò chuyện từ lúc đó.", " to keep conversations from then on.")}
          </p>
          <button
            type="button"
            onClick={dismissGuestNotice}
            title={tr("Đóng và không hiện lại", "Dismiss and don't show again")}
            aria-label={tr("Đóng thông báo chế độ khách và không hiện lại", "Dismiss the guest-mode notice and don't show it again")}
            className="shrink-0 -mr-1 -mt-0.5 w-8 h-8 grid place-items-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-primary/15"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {messages.map((m, i) => (
        <Message key={i} message={m} />
      ))}

      {sending && (
        <div className="flex items-start gap-4 animate-pulse">
          <AiAvatar />
          <div className="bg-surface-container-high p-5 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm">
            <div className="flex flex-col gap-2">
              <div className="h-2 w-24 bg-outline-variant/30 rounded"></div>
              <div className="h-2 w-48 bg-outline-variant/30 rounded"></div>
              <div className="h-2 w-32 bg-outline-variant/30 rounded"></div>
            </div>
          </div>
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">
        <p className="font-semibold">{tr("Chưa gửi được câu hỏi", "Couldn't send your question")}</p>
        <p className="mt-1 break-words">{error}</p>
        <button type="button" disabled={!canAsk || sending} onClick={() => handleSendPrompt(failedQuestion)} className="mt-3 underline disabled:opacity-50">{tr("Thử lại", "Try again")}</button>
      </div>}

      {/* Input Area: Fixed to Bottom */}
      <div className="fixed bottom-0 right-0 left-sidebar-width z-30 pointer-events-none">
        <div className="max-w-chat-max-width mx-auto px-margin-mobile md:px-0 pb-8 pointer-events-auto">
          <p role="status" className="mb-2 text-xs text-on-surface-variant">{statusText}</p>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-container/20 to-primary-container/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <form onSubmit={send} className="relative flex flex-col bg-surface-container-lowest border border-outline-variant rounded-full p-2 pr-3 shadow-xl transition-all duration-300 focus-within:shadow-2xl">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant" 
                  title={t("Upload Report")}
                  aria-label={tr("Tải tài liệu lên", "Upload documents")}
                  onClick={onUploadClick}
                >
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <button
                  type="button"
                  title="Xem các tài liệu đã tải lên"
                  aria-label={`Xem ${documentCount} tài liệu trong hội thoại`}
                  onClick={() => document.getElementById("finsight-document-manager")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  <span>{documentCount}</span>
                </button>
                <input 
                  className="min-w-0 flex-1 bg-transparent border-none outline-none px-2 font-body-lg text-body-lg text-on-surface placeholder:text-outline"
                  aria-label={tr("Câu hỏi về tài liệu", "Question about your documents")}
                  placeholder={processing ? (tr("Soạn câu hỏi trong lúc chờ...", "Draft a question...")) : ready ? t("Ask about your documents...") : t("Upload a document to begin...")}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={sending}
                />
                <button 
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary hover:bg-on-background transition-transform active:scale-95 ${sending || !question.trim() ? 'opacity-50' : ''}`}
                  type="submit"
                  disabled={sending || !question.trim() || !canAsk}
                  title={canAsk ? (tr("Gửi câu hỏi", "Send question")) : statusText}
                  aria-label={tr("Gửi câu hỏi", "Send question")}
                >
                  {sending ? (
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

function Message({ message }) {
  const { t, lang } = useLanguage();
  const [copyStatus, setCopyStatus] = useState("");
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyStatus(lang === "VN" ? "Đã sao chép" : "Copied");
      setTimeout(() => setCopyStatus(""), 2500);
    } catch {
      setCopyStatus(lang === "VN" ? "Không thể sao chép. Hãy chọn văn bản để sao chép." : "Couldn't copy. Select the text to copy it.");
    }
  }
  const isUser = message.role === "user";
  
  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-primary text-on-primary p-5 rounded-2xl rounded-tr-none max-w-[85%] shadow-md">
          <p className="font-body-lg text-body-lg whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AiAvatar className="mt-1" />
      <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/40 p-4 md:p-6 rounded-2xl rounded-tl-none shadow-sm w-full">
        <div className="answer-markdown text-on-surface">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            table: ({ node, ...props }) => <div className="answer-table" tabIndex={0} role="region" aria-label={lang === "VN" ? "Bảng số liệu, cuộn ngang để xem" : "Data table, scroll horizontally"}><table {...props} /></div>,
            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          }}>{message.content}</ReactMarkdown>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-outline-variant/30 pt-3">
          <button type="button" onClick={copyAnswer} className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[16px]">content_copy</span>{lang === "VN" ? "Sao chép" : "Copy"}</button>
          <span role="status" className="text-xs text-on-surface-variant">{copyStatus}</span>
        </div>
        
        {message.citations?.length > 0 && (
          <details className="mt-4 border-t border-outline-variant/30 pt-4 group">
            <summary className="cursor-pointer font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface flex items-center gap-1 uppercase">
              <span className="material-symbols-outlined text-[14px] transition-transform group-open:rotate-90">chevron_right</span>
              {message.citations.length} {t(message.citations.length === 1 ? "source" : "sources")}
            </summary>
            <div className="mt-4 flex flex-col gap-3">
              {message.citations.map((c) => (
                <div key={c.rank} className="bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/30">
                  <div className="flex items-center gap-2 mb-2 font-label-mono text-[11px] text-on-surface-variant">
                    <span className="bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">[{c.rank}]</span>
                    <span className="truncate max-w-[200px] text-on-surface">{c.doc_name}</span>
                    {c.page && <span>· p.{c.page}</span>}
                  </div>
                  <p className="font-body-sm text-sm text-on-surface-variant italic border-l-2 border-secondary/30 pl-3">"{c.snippet}"</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
