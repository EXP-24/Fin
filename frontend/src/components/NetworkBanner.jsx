import { useEffect, useState } from "react";

/** Slim banner shown while the browser reports it is offline. */
export default function NetworkBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="alert" className="fixed top-0 inset-x-0 z-[110] flex items-center justify-center gap-2 bg-error-container text-on-error-container text-sm py-1.5">
      <span className="material-symbols-outlined text-[18px]">wifi_off</span>
      Mất kết nối mạng. Thao tác sẽ không được lưu cho đến khi có mạng trở lại.
    </div>
  );
}
