import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";
import { useConfirm } from "./ConfirmDialog.jsx";
import { useToast } from "./Toast.jsx";

const ACCEPT = ".pdf,.md,.markdown,.json";

// Document tray that stays visible above the fixed chat composer.
// Compatible with the existing SessionPage props and FastAPI document endpoints.
export default function DocumentPanel({ sessionId, documents = [], onChange, inputRef }) {
  const { lang, tr } = useLanguage();
  const confirm = useConfirm();
  const toast = useToast();
  const docs = Array.isArray(documents) ? documents : [];
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const hasProcessing = docs.some((d) => d.status === "processing");

  useEffect(() => {
    setExpanded(true);
    setError("");
  }, [sessionId]);

  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => {
      Promise.resolve(onChange()).catch((e) => setError(e.message || String(e)));
    }, 1500);
    return () => clearInterval(timer);
  }, [hasProcessing, onChange]);

  async function uploadFiles(files) {
    if (!files.length || uploading) return;
    setError("");
    setExpanded(true);
    setUploading(true);
    try {
      for (const file of files) {
        await api.uploadDocument(sessionId, file);
      }
      await onChange();
    } catch (e) {
      setError(e.message || String(e));
      // Some uploads may have succeeded before another failed.
      try { await onChange(); } catch { /* original error is retained */ }
    } finally {
      setUploading(false);
      if (inputRef?.current) inputRef.current.value = "";
    }
  }

  async function deleteFile(doc) {
    if (deletingId !== null) return;
    const prompt = tr(`Xóa tài liệu "${doc.filename}" khỏi hội thoại này?`, `Remove "${doc.filename}" from this conversation?`);
    const ok = await confirm({
      title: tr("Xóa tài liệu?", "Remove document?"),
      message: prompt + (tr(" Các câu trả lời dựa trên tài liệu này sẽ không còn dẫn nguồn được.", " Answers that cite it will lose their source.")),
      confirmText: tr("Xóa", "Remove"),
      cancelText: tr("Hủy", "Cancel"),
      danger: true,
    });
    if (!ok) return;
    setError("");
    setDeletingId(doc.id);
    try {
      await api.deleteDocument(sessionId, doc.id);
      await onChange();
      toast.success(tr("Đã xóa tài liệu.", "Document removed."));
    } catch (e) {
      setError(e.message || String(e));
      try { await onChange(); } catch { /* keep the delete error */ }
    } finally {
      setDeletingId(null);
    }
  }

  function statusLabel(doc) {
    if (doc.status === "processing") {
      return tr(`Đang xử lý ${doc.progress ?? 0}%`, `Processing ${doc.progress ?? 0}%`);
    }
    if (doc.status === "ready") {
      return tr(`Sẵn sàng · ${doc.chunk_count ?? 0} đoạn`, `Ready · ${doc.chunk_count ?? 0} chunks`);
    }
    if (doc.status === "failed") return tr("Xử lý thất bại", "Processing failed");
    return doc.status || (tr("Chưa rõ trạng thái", "Unknown status"));
  }

  return (
    <div id="finsight-document-manager" className="relative w-full scroll-mt-24">
      <div className="w-full">
        <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              title={tr("Ẩn/hiện tài liệu", "Show/hide documents")}
              className="flex min-w-0 items-center gap-2 text-on-surface hover:opacity-80"
            >
              <span className="material-symbols-outlined text-[19px]">folder_open</span>
              <span className="text-sm font-semibold truncate">
                {tr("Tài liệu", "Documents")} ({docs.length})
              </span>
              <span className="material-symbols-outlined text-[18px]">
                {expanded ? "expand_more" : "expand_less"}
              </span>
            </button>
            <button type="button" disabled={uploading} onClick={() => inputRef?.current?.click()} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs text-on-primary disabled:opacity-50">
              {uploading ? (tr("Đang tải...", "Uploading...")) : (tr("+ Tải tài liệu", "+ Upload"))}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              if (selected.length) uploadFiles(selected);
            }}
          />

          {error && <div role="alert" className="mx-3 mb-2 rounded-lg bg-error-container px-3 py-2 text-xs text-on-error-container">{error}</div>}
          {uploading && (
            <div role="status" className="px-4 pb-2 text-xs text-on-surface-variant animate-pulse">
              {tr("Đang tải tài liệu lên...", "Uploading documents...")}
            </div>
          )}

          {expanded && (
            <div className="max-h-44 overflow-y-auto border-t border-outline-variant/30 px-3 py-2 space-y-1.5">
              {docs.length === 0 && !uploading && (
                <p className="text-xs text-on-surface-variant py-1">
                  {tr("Chưa có tài liệu nào trong hội thoại này.", "No documents in this conversation yet.")}
                </p>
              )}
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[19px] text-on-surface-variant shrink-0">
                    {doc.kind === "pdf" ? "picture_as_pdf" : "description"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-on-surface truncate" title={doc.filename}>{doc.filename}</div>
                    <div
                      className={`text-[11px] ${doc.status === "failed" ? "text-error" : "text-on-surface-variant"}`}
                      title={doc.error || ""}
                    >
                      {statusLabel(doc)}
                    </div>
                    {doc.status === "processing" && <progress className="document-progress mt-2 block w-full" max={100} value={Math.max(0, Math.min(100, doc.progress ?? 0))} aria-label={statusLabel(doc)} />}
                    {doc.status === "failed" && <p className="mt-1 text-xs text-error break-words">{doc.error || (tr("Vui lòng xóa tài liệu và tải lại.", "Please remove the document and upload it again."))}</p>}
                    {doc.status === "ready" && doc.warning_count > 0 && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-tertiary break-words" role="status">
                        <span className="material-symbols-outlined text-[14px] shrink-0" aria-hidden="true">warning</span>
                        <span>
                          {tr(`${doc.warning_count} phép kiểm tra số học không khớp (có thể do OCR đọc sai). Xem chi tiết ở mục Báo cáo.`, `${doc.warning_count} arithmetic checks do not match (possibly an OCR misread). See Reports for details.`)}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    title={tr(`Xóa ${doc.filename}`, `Delete ${doc.filename}`)}
                    aria-label={tr(`Xóa tài liệu ${doc.filename}`, `Delete document ${doc.filename}`)}
                    disabled={deletingId !== null}
                    onClick={() => deleteFile(doc)}
                    className="flex shrink-0 w-8 h-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {deletingId === doc.id ? "hourglass_empty" : "delete"}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
