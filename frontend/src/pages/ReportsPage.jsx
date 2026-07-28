import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function ReportsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function load() {
    try {
      setSessions(await api.listSessions());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this report and all of its documents?")) return;
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined text-[24px]">description</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Uploaded Reports</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">View and manage your document analysis sessions.</p>
        </div>
      </div>

      {error && <p className="text-error mb-4">{error}</p>}

      <div className="space-y-4">
        {loading ? (
          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
            Loading reports…
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
            No reports yet. Start a new analysis from the dashboard.
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="bg-surface-container-low hover:bg-surface-container-high transition-colors p-6 rounded-xl border border-outline-variant/30 cursor-pointer flex flex-col gap-2 group"
              onClick={() => navigate(`/sessions/${s.id}`)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md-mobile text-headline-md-mobile text-on-surface">{s.name}</h3>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-on-error-container transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete report"
                  onClick={(e) => handleDelete(e, s.id)}
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
              {s.description && <p className="font-body-sm text-body-sm text-on-surface-variant">{s.description}</p>}
              <div className="flex items-center gap-2 mt-2 font-label-mono text-label-mono text-outline">
                <span>{s.document_count} document{s.document_count === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{s.chunk_count} chunks</span>
                <span>•</span>
                <span>{formatDate(s.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
