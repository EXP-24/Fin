import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";

const ACCEPT = ".pdf,.md,.markdown,.json";

export default function DocumentPanel({ sessionId, documents, onChange, inputRef }) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const hasProcessing = documents.some((d) => d.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => { onChange(); }, 1500);
    return () => clearInterval(timer);
  }, [hasProcessing, onChange]);

  async function uploadFiles(files) {
    setError("");
    setUploading(true);
    try {
      for (const file of files) {
        await api.uploadDocument(sessionId, file);
      }
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(docId) {
    if (!confirm("Remove this document from the session?")) return;
    try {
      await api.deleteDocument(sessionId, docId);
      await onChange();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="fixed bottom-24 right-0 left-sidebar-width z-20 pointer-events-none flex justify-center">
      <div className="max-w-chat-max-width w-full px-margin-desktop pointer-events-auto flex flex-wrap gap-2 justify-center">
        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => e.target.files?.length && uploadFiles([...e.target.files])}
        />

        {error && <div className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-xs font-label-mono">{error}</div>}
        {uploading && (
          <div className="flex items-center gap-2 bg-surface-container-highest px-3 py-1.5 rounded-full shadow-sm text-xs font-label-mono text-on-surface animate-pulse border border-outline-variant/30">
            <span className="material-symbols-outlined text-[14px]">cloud_upload</span> {t("Uploading...")}
          </div>
        )}

        {documents.map((d) => (
          <div key={d.id} className="flex items-center gap-2 bg-surface-container-highest px-3 py-1.5 rounded-full shadow-sm border border-outline-variant/30 group">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-label-mono uppercase ${d.kind === 'pdf' ? 'bg-error/10 text-error' : 'bg-primary-container/10 text-primary-fixed-dim'}`}>
              {d.kind}
            </span>
            <span className="text-xs font-body-sm text-on-surface max-w-[120px] truncate" title={d.filename}>{d.filename}</span>
            
            {d.status === "processing" ? (
              <span className="text-[10px] font-label-mono text-secondary ml-1 animate-pulse">{(d.progress ?? 0)}%</span>
            ) : d.status === "failed" ? (
              <span className="text-[10px] font-label-mono text-error ml-1" title={d.error}>{t("Failed")}</span>
            ) : (
               <span className="text-[10px] font-label-mono text-on-surface-variant ml-1">{d.chunk_count}c</span>
            )}
            
            <button 
              className="ml-1 w-4 h-4 rounded-full flex items-center justify-center hover:bg-error/20 hover:text-error text-on-surface-variant transition-colors"
              onClick={() => handleDelete(d.id)}
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
