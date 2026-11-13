import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { api } from "../api.js";
import DocumentPanel from "../components/DocumentPanel.jsx";
import ChatPanel from "../components/ChatPanel.jsx";

export default function SessionPage() {
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

  if (loading) return <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 py-12"><div className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">Loading session…</div></div>;
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
    <div className="flex flex-col w-full max-w-chat-max-width mx-auto px-margin-mobile md:px-0 pb-32">
      <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{session.name}</h1>
          {session.description && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{session.description}</p>}
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
