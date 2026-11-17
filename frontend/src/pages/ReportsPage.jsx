import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n.jsx";
import { useConfirm } from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import ValidationSection from "../components/ValidationSection.jsx";

const PAGE_SIZE = 5;
const FILTERS = ["all", "ready", "processing", "failed"];
const KIND_ICON = { pdf: "picture_as_pdf", md: "article", json: "data_object" };
const STATUS_STYLE = {
  ready: { text: "text-secondary", bg: "bg-secondary/10", dot: "bg-secondary" },
  processing: { text: "text-tertiary", bg: "bg-tertiary/10", dot: "bg-tertiary" },
  failed: { text: "text-error", bg: "bg-error-container/40", dot: "bg-error" },
};
const STATUS_LABEL = { ready: "Ready", processing: "Processing", failed: "Failed" };
const SOURCE_LABEL = { markdown: "Markdown", json: "JSON", ocr: "OCR", "pdf-text": "PDF text" };

function StatusBadge({ status, t }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.processing;
  return (
    <span className={`font-label-mono text-label-mono uppercase font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${s.text} ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {t(STATUS_LABEL[status] || status)}
    </span>
  );
}

function StatCard({ label, title, icon, tone, children }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-label-mono text-label-mono uppercase text-outline">{label}</span>
          <span className="text-on-surface font-semibold">{title}</span>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { lang, t } = useLanguage();
  const confirmDialog = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const locale = lang === "VN" ? "vi-VN" : "en-US";

  const [items, setItems] = useState([]); // [{ doc, session }]
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const sessions = await api.listSessions();
      const lists = await Promise.all(sessions.map((s) => api.listDocuments(s.id)));
      const all = sessions.flatMap((session, i) => lists[i].map((doc) => ({ doc, session })));
      all.sort((a, b) => new Date(b.doc.uploaded_at) - new Date(a.doc.uploaded_at));
      setSessionCount(sessions.length);
      setItems(all);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any document is still being indexed.
  const hasProcessing = items.some((x) => x.doc.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [hasProcessing, load]);

  const counts = useMemo(() => {
    const c = { all: items.length, ready: 0, processing: 0, failed: 0 };
    items.forEach((x) => { c[x.doc.status] = (c[x.doc.status] || 0) + 1; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(({ doc, session }) =>
      (filter === "all" || doc.status === filter) &&
      (!q || doc.filename.toLowerCase().includes(q) || session.name.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = items.find((x) => x.doc.id === selectedId) || filtered[0] || null;

  const totalChunks = items.reduce((n, x) => n + x.doc.chunk_count, 0);
  const totalChars = items.reduce((n, x) => n + x.doc.chars, 0);
  const readyPct = items.length ? Math.round((counts.ready / items.length) * 100) : 0;
  const kindCounts = items.reduce((m, x) => ({ ...m, [x.doc.kind]: (m[x.doc.kind] || 0) + 1 }), {});

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "");
  const fmtNum = (n) => n.toLocaleString(locale);

  async function handleDelete({ doc, session }) {
    const ok = await confirmDialog({
      title: lang === "VN" ? "Xóa tài liệu?" : "Delete document?",
      message: t("Delete this document? Analysis results that use it will be affected."),
      confirmText: lang === "VN" ? "Xóa" : "Delete",
      cancelText: lang === "VN" ? "Hủy" : "Cancel",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteDocument(session.id, doc.id);
      setItems((prev) => prev.filter((x) => x.doc.id !== doc.id));
      toast.success(lang === "VN" ? "Đã xóa tài liệu." : "Document deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="w-full px-margin-mobile md:px-margin-desktop py-8 flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">{t("Saved reports & documents")}</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {t("Manage the documents of every analysis profile, track processing status and open the analysis workspace.")}
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity shrink-0 self-start lg:self-auto"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          {t("New analysis profile")}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 bg-error-container/40 text-on-error-container rounded-lg px-4 py-3">
          <span>{error}</span>
          <button className="underline font-medium" onClick={load}>{t("Retry")}</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={t("Document library")} title={t("Total documents")} icon="inventory_2" tone="bg-primary/10 text-primary">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-label-mono text-[28px] font-semibold text-on-surface">{fmtNum(items.length)}</span>
              <span className="text-body-sm text-on-surface-variant">{fmtNum(sessionCount)} {t("profiles")}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["pdf", "md", "json"].filter((k) => kindCounts[k]).map((k) => (
                <span key={k} className="px-2 py-1 rounded bg-surface-container-high font-label-mono text-label-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">{KIND_ICON[k]}</span>
                  {k.toUpperCase()} · {kindCounts[k]}
                </span>
              ))}
            </div>
          </div>
        </StatCard>

        <StatCard label={t("Processing status")} title={t("Documents ready to analyse")} icon="task_alt" tone="bg-secondary/10 text-secondary">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-label-mono text-[28px] font-semibold text-secondary">{readyPct}%</span>
              <span className="text-body-sm text-on-surface-variant">{counts.ready}/{items.length} {t("ready")}</span>
            </div>
            <div className="mt-3 h-1.5 bg-surface-container-highest rounded-full overflow-hidden" role="progressbar" aria-valuenow={readyPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-secondary rounded-full" style={{ width: `${readyPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-label-mono text-label-mono text-outline">
              <span>{counts.processing} {t("processing")}</span>
              <span className={counts.failed ? "text-error" : ""}>{counts.failed} {t("failed")}</span>
            </div>
          </div>
        </StatCard>

        <StatCard label={t("Indexed data")} title={t("Searchable content")} icon="database" tone="bg-tertiary/10 text-tertiary">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-label-mono text-[28px] font-semibold text-on-surface">{fmtNum(totalChunks)}</span>
              <span className="text-body-sm text-on-surface-variant">{t("chunks")}</span>
            </div>
            <div className="mt-3 font-label-mono text-label-mono text-outline">{fmtNum(totalChars)} {t("characters")}</div>
          </div>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center overflow-x-auto w-full sm:w-auto p-1 bg-surface-container-lowest rounded-lg" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                    filter === f ? "bg-primary text-on-primary font-semibold" : "text-on-surface-variant hover:text-on-surface font-medium"
                  }`}
                >
                  {f === "all" ? t("All") : t(STATUS_LABEL[f])} ({counts[f] || 0})
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-60">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                aria-label={t("Search by file or profile name...")}
                placeholder={t("Search by file or profile name...")}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-container text-on-surface placeholder:text-outline text-body-sm focus:outline-none focus:bg-surface-container-high"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              [0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-container-low animate-pulse" />)
            ) : filtered.length === 0 ? (
              <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 text-center text-on-surface-variant">
                {items.length === 0 ? t("No documents yet. Create a profile and upload a report to begin.") : t("No documents match the current filter.")}
              </div>
            ) : (
              pageItems.map((entry) => {
                const { doc, session } = entry;
                const active = selected?.doc.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(doc.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(doc.id); } }}
                    className={`relative overflow-hidden cursor-pointer rounded-xl border p-4 flex flex-col gap-3 transition-colors group ${
                      active ? "bg-surface-container border-primary/40" : "bg-surface-container-low border-outline-variant/30 hover:bg-surface-container"
                    }`}
                  >
                    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">{KIND_ICON[doc.kind] || "description"}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-label-mono text-label-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface truncate max-w-[200px]">{session.name}</span>
                            <StatusBadge status={doc.status} t={t} />
                            {doc.warning_count > 0 && (
                              <span
                                className="font-label-mono text-label-mono px-2 py-0.5 rounded flex items-center gap-1 text-tertiary bg-tertiary/10"
                                title={t("Arithmetic check")}
                              >
                                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">warning</span>
                                {doc.warning_count}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-on-surface mt-1 break-words">{doc.filename}</h3>
                        </div>
                      </div>
                      <span className="font-label-mono text-label-mono text-outline px-2 py-1 rounded bg-surface-container-lowest shrink-0">{doc.kind.toUpperCase()}</span>
                    </div>
                    {doc.status === "processing" && (
                      <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden" role="progressbar" aria-valuenow={doc.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full bg-tertiary rounded-full transition-all" style={{ width: `${doc.progress}%` }} />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-outline text-body-sm">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">schedule</span>{fmtDate(doc.uploaded_at)}</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">view_agenda</span>{fmtNum(doc.chunk_count)} {t("chunks")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          title={t("Open analysis")}
                          aria-label={t("Open analysis")}
                          onClick={(e) => { e.stopPropagation(); navigate(`/sessions/${session.id}`); }}
                          className="p-1.5 rounded hover:bg-surface-variant text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </button>
                        <button
                          title={t("Delete document")}
                          aria-label={t("Delete document")}
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                          className="p-1.5 rounded hover:bg-error-container hover:text-on-error-container text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-2 text-on-surface-variant text-body-sm">
              <span>{t("Showing")} {pageItems.length} / {filtered.length} {t("documents")}</span>
              <div className="flex items-center gap-1">
                <button aria-label={t("Previous page")} disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="px-3 font-label-mono text-label-mono">{safePage} / {pageCount}</span>
                <button aria-label={t("Next page")} disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)} className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="xl:col-span-5 xl:sticky xl:top-20 bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">preview</span>
            <h2 className="font-semibold text-on-surface">{t("Document details")}</h2>
          </div>
          {!selected ? (
            <p className="text-on-surface-variant text-body-sm">{t("Select a document to see its details.")}</p>
          ) : (
            <>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusBadge status={selected.doc.status} t={t} />
                  {SOURCE_LABEL[selected.doc.source] && (
                    <span className="font-label-mono text-label-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {t("Extracted via")} {SOURCE_LABEL[selected.doc.source]}
                    </span>
                  )}
                </div>
                <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface break-words">{selected.doc.filename}</h3>
                <p className="text-body-sm text-on-surface-variant mt-1">{t("Profile")}: {selected.session.name}</p>
              </div>

              {selected.doc.status === "failed" && selected.doc.error && (
                <div role="alert" className="rounded-lg bg-error-container/40 text-on-error-container p-3 text-body-sm break-words">
                  {selected.doc.error}
                </div>
              )}

              <dl className="grid grid-cols-3 gap-2">
                {[
                  [t("Chunks"), fmtNum(selected.doc.chunk_count)],
                  [t("Characters"), fmtNum(selected.doc.chars)],
                  [t("Uploaded"), fmtDate(selected.doc.uploaded_at)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-surface-container rounded-lg p-3 min-w-0">
                    <dt className="font-label-mono text-label-mono uppercase text-outline">{k}</dt>
                    <dd className="font-label-mono text-on-surface font-semibold mt-1 break-words">{v}</dd>
                  </div>
                ))}
              </dl>

              <ValidationSection sessionId={selected.session.id} doc={selected.doc} t={t} locale={locale} />

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/sessions/${selected.session.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  {t("Open analysis")}
                </button>
                <button
                  onClick={() => handleDelete(selected)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-surface-container hover:bg-error-container hover:text-on-error-container text-on-surface text-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  {t("Delete")}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
