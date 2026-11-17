import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ConfirmContext = createContext(null);

/** `const confirm = useConfirm(); if (await confirm({ title, message, danger })) ...` */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const cancelRef = useRef(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    []
  );

  const close = useCallback((result) => {
    setDialog((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => close(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="dialog-in relative w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface-container-low/95 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined grid place-items-center w-10 h-10 rounded-xl ${dialog.danger ? "bg-error/15 text-error" : "bg-primary/15 text-primary"}`}>
                {dialog.danger ? "delete" : "help"}
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-lg font-semibold text-on-surface">{dialog.title}</h2>
                {dialog.message && <p className="mt-1.5 text-sm text-on-surface-variant leading-relaxed">{dialog.message}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => close(false)} className="h-10 px-4 rounded-lg border border-outline-variant/70 text-sm font-medium text-on-surface hover:bg-primary/10">
                {dialog.cancelText || "Hủy"}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`h-10 px-4 rounded-lg text-sm font-semibold ${dialog.danger ? "bg-error text-on-error hover:brightness-110" : "bg-primary text-on-primary"}`}
              >
                {dialog.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
