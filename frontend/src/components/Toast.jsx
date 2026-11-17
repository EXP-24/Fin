import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);
const ICONS = { success: "check_circle", error: "error", info: "info" };
const TONES = {
  success: "border-secondary/50 text-secondary",
  error: "border-error/50 text-error",
  info: "border-primary/50 text-primary",
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((message, kind = "info", ms = 4200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((list) => [...list.slice(-3), { id, message, kind }]);
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const api = useMemo(() => ({
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error", 6500),
    info: (m) => push(m, "info"),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`toast-in flex items-start gap-3 rounded-xl border bg-surface-container-low/90 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/30 ${TONES[item.kind]}`}
          >
            <span className="material-symbols-outlined text-[20px] mt-px">{ICONS[item.kind]}</span>
            <p className="flex-1 text-sm text-on-surface leading-snug">{item.message}</p>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Đóng thông báo" className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
