import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";

export default function ChatPanel({ sessionId, ready, initialPrompt, draftPrompt = "", onUploadClick, documentCount = 0, hasPendingDocuments = false }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState(() => draftPrompt);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  // Initialize with initialPrompt if provided
  
  const submittingRef = useRef(false);
  const documentsNotReady = documentCount > 0 && (!ready || hasPendingDocuments);

  useEffect(() => {
    let active = true;
    let timerId;

    api.getHistory(sessionId)
      .then((history) => {
        if (!active) return;

        setMessages(history);

        const prompt = initialPrompt?.trim();
        if (!prompt) return;

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
  }, [sessionId, initialPrompt]);


  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSendPrompt(q) {
    if (!q || submittingRef.current) return;
    if (documentsNotReady) {
      setError("Tài liệu đang được xử lý. Vui lòng chờ đến khi các tài liệu hiển thị ‘Sẵn sàng’ rồi gửi câu hỏi.");
      return;
    }
    submittingRef.current = true;
    setError("");
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
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary text-sm">auto_awesome</span>
          </div>
          <div className="bg-surface-container-high p-5 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm">
            <p className="font-body-lg text-body-lg text-on-surface">{t("I've initialized this session. Please upload your documents or type a query to begin.")}</p>
            <div className="mt-4 flex gap-2">
              <span className="font-label-mono text-label-mono px-2 py-1 bg-surface-container-highest rounded border border-outline-variant/30 text-on-surface-variant">ENGINE: GPT-4-FIN</span>
            </div>
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <Message key={i} message={m} />
      ))}

      {sending && (
        <div className="flex items-start gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary text-sm">auto_awesome</span>
          </div>
          <div className="bg-surface-container-high p-5 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm">
            <div className="flex flex-col gap-2">
              <div className="h-2 w-24 bg-outline-variant/30 rounded"></div>
              <div className="h-2 w-48 bg-outline-variant/30 rounded"></div>
              <div className="h-2 w-32 bg-outline-variant/30 rounded"></div>
            </div>
          </div>
        </div>
      )}

      {documentsNotReady && (
        <p role="status" className="text-center text-sm text-on-surface-variant">
          Tài liệu đang được lập chỉ mục. Bạn có thể chỉnh sửa câu hỏi và gửi khi xử lý xong.
        </p>
      )}
      {error && <p className="text-error text-center font-body-sm bg-error-container/20 p-2 rounded-lg">{error}</p>}

      {/* Input Area: Fixed to Bottom */}
      <div className="fixed bottom-0 right-0 left-sidebar-width z-30 pointer-events-none">
        <div className="max-w-chat-max-width mx-auto px-margin-desktop pb-8 pointer-events-auto">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-secondary-container/20 to-primary-container/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <form onSubmit={send} className="relative flex flex-col bg-surface-container-lowest border border-outline-variant rounded-full p-2 pr-3 shadow-xl transition-all duration-300 focus-within:shadow-2xl">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant" 
                  title="Upload Report"
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
                  className="flex-1 bg-transparent border-none outline-none px-4 font-body-lg text-body-lg text-on-surface placeholder:text-outline" 
                  placeholder={documentsNotReady ? "Đang xử lý tài liệu..." : ready ? t("Ask about your documents...") : t("Upload a document to begin...")}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={sending}
                />
                <button 
                  className={`flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary hover:bg-on-background transition-transform active:scale-95 ${sending || !question.trim() ? 'opacity-50' : ''}`}
                  type="submit"
                  disabled={sending || documentsNotReady || !question.trim()}
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
            {t("FinAI can make mistakes. Check important financial info.")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Message({ message }) {
  const { t } = useLanguage();
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
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
        <span className="material-symbols-outlined text-on-primary text-sm">auto_awesome</span>
      </div>
      <div className="bg-surface-container-high p-6 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm w-full">
        <div className="font-body-lg text-body-lg text-on-surface leading-relaxed prose prose-slate">
          {/* A proper markdown renderer would be better here, but for now we just handle newlines */}
          {message.content.split('\n').map((line, i) => (
            <p key={i} className="mb-2">{line}</p>
          ))}
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
                    <span className="ml-auto text-secondary">{Math.round(c.score * 100)}% {t("match")}</span>
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
