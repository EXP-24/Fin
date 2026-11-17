import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center text-center px-6 pt-24 pb-16 max-w-lg">
      <Logo size={88} className="orbit-float opacity-90" />
      <p className="mt-6 text-7xl font-extrabold tracking-tight text-gradient">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-on-surface">Lạc khỏi quỹ đạo rồi</h1>
      <p className="mt-2 text-on-surface-variant">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>
      <div className="mt-8 flex gap-3">
        <Link to="/" className="h-11 px-6 rounded-lg bg-primary text-on-primary font-semibold inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">home</span>Về trang chủ
        </Link>
        <button type="button" onClick={() => window.dispatchEvent(new Event("finsight:palette"))} className="h-11 px-5 rounded-lg border border-outline-variant/70 text-sm inline-flex items-center gap-2 hover:bg-primary/10">
          <span className="material-symbols-outlined text-[18px]">search</span>Tìm kiếm
        </button>
      </div>
    </div>
  );
}
