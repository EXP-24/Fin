import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { api } from "../api.js";
import DocumentPanel from "../components/DocumentPanel.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { useLanguage } from "../i18n.jsx";

export default function SessionPage() {
  const { t } = useLanguage();
  const { sessionId } = useParams();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // We extract the initial prompt passed from the HomePage (if any)
  const initialPrompt = location.state?.initialPrompt || "";
const draftPrompt = location.state?.draftPrompt || "";

  const uploadInputRef = useRef(null);

  const refresh = useCallback(async () => {
    const [detail, docs] = await Promise.all([
      api.getSession(sessionId),
      api.listDocuments(sessionId),
    ]);
    setSession(detail);
    setDocuments(docs);
  }, [sessionId]);

  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  if (loading) return <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 py-12"><div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">{t("Loading session…")}</div></div>;
  if (error) {
    return (
      <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 py-12">
        <div className="bg-error-container p-6 rounded-xl border border-error/30 text-on-error-container text-center">
          <p className="mb-4">{error}</p>
        </div>
      </div>
    );
  }

  const ready = documents.some((d) => d.status === "ready");
  const hasPendingDocuments = documents.some((d) =>
    ["processing", "pending", "queued", "indexing"].includes(d.status)
  );

  return (
    <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 pt-6 pb-44 md:pb-40">
      <div className="w-full mb-8 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 glow-ring">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Phân tích AI</p>
            <h1 className="mt-1 font-headline-md text-headline-md text-on-surface truncate">{session.name}</h1>
            {session.description && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{session.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container/60 px-3 py-1.5 tabular-nums"><span className="material-symbols-outlined text-[16px] text-primary">description</span>{documents.length} tài liệu</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container/60 px-3 py-1.5 tabular-nums"><span className="material-symbols-outlined text-[16px] text-primary">data_array</span>{session.chunk_count ?? 0} đoạn đã lập chỉ mục</span>
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${ready ? "border-secondary/40 bg-secondary/10 text-secondary" : hasPendingDocuments ? "border-primary/40 bg-primary/10 text-primary" : "border-outline-variant/60 text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-[16px]">{ready ? "check_circle" : hasPendingDocuments ? "autorenew" : "upload_file"}</span>
              {ready ? "Sẵn sàng phân tích" : hasPendingDocuments ? "Đang xử lý tài liệu" : "Chưa có tài liệu"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full space-y-6">
        <DocumentPanel 
          sessionId={sessionId} 
          documents={documents} 
          onChange={refresh} 
          inputRef={uploadInputRef}
        />
        <ChatPanel 
          key={sessionId}
          sessionId={sessionId} 
          ready={ready}
          hasPendingDocuments={hasPendingDocuments} 
          initialPrompt={initialPrompt}
draftPrompt={draftPrompt}
          onUploadClick={() => uploadInputRef.current?.click()}
          documentCount={documents.length}
        />
      </div>
    </div>
  );
}
