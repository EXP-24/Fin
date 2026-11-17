import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";
import GalaxyBackdrop from "../components/GalaxyBackdrop.jsx";
import { useLanguage } from "../i18n.jsx";

const glass = "border border-primary/15 bg-white/65 shadow-[0_10px_36px_-12px_rgba(60,50,160,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/20 dark:bg-white/[0.07] dark:shadow-[0_8px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl backdrop-saturate-150";
// Underline-only inputs on frosted glass.
const field = "w-full h-11 rounded-none border-0 border-b border-on-surface/30 bg-transparent px-1 text-on-surface placeholder:text-on-surface/40 outline-none transition focus:border-primary focus:shadow-[0_1px_0_0_rgb(var(--c-primary))] disabled:opacity-60";

export default function LoginPage() {
  const { user, setUser, loading, reload } = useAuth();
  const { lang, setLang, tr } = useLanguage();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const requested = location.state?.from;
  const destination = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//") && requested !== "/login" ? requested : "/";

  if (loading) return <div role="status" className="min-h-screen grid place-items-center text-on-surface">{tr("Đang tải...", "Loading...")}</div>;
  if (user?.status === "member") return <Navigate to={destination} replace />;

  function switchMode(next) {
    setRegister(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (register && password !== confirm) {
      setError(tr("Mật khẩu xác nhận chưa khớp.", "Password confirmation does not match."));
      return;
    }
    setBusy(true);
    try {
      setUser(await api[register ? "register" : "login"](username.trim().toLowerCase(), password));
      setPassword("");
      setConfirm("");
      navigate(destination, { replace: true });
      // Clear a prior server connectivity error in the auth provider.
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen text-on-surface lg:grid lg:grid-cols-[1.05fr_1fr]">
      <GalaxyBackdrop />

      <div className="absolute right-4 top-4 z-20 flex rounded-lg border border-primary/20 dark:border-white/20 bg-white/40 dark:bg-white/10 p-0.5 text-xs font-semibold backdrop-blur-xl" role="group" aria-label="Language">
        {["VN", "EN"].map((code) => (
          <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code} className={`h-7 px-2.5 rounded-md transition-colors ${lang === code ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>{code}</button>
        ))}
      </div>

      {/* Brand panel */}
      <section className="relative z-10 hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <Logo size={44} className="orbit-float" />
          <div className="leading-tight">
            <p className="text-2xl font-bold tracking-tight text-gradient">FinSight</p>
            <p className="text-xs text-on-surface-variant">{tr("Phân tích báo cáo tài chính", "Financial report analysis")}</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgb(var(--c-secondary))]" />
            {tr("Phân tích báo cáo tài chính bằng AI", "AI-powered financial report analysis")}
          </p>
          <h1 className="mt-5 text-4xl xl:text-[44px] font-bold leading-[1.15] tracking-tight text-balance">
            {tr("Hỏi đáp báo cáo tài chính, ", "Ask your financial reports, ")}<span className="text-gradient">{tr("có dẫn nguồn", "with cited sources")}</span>
          </h1>
          <p className="mt-5 text-base text-on-surface-variant leading-relaxed">
            {tr("Tải báo cáo lên một phiên làm việc, rồi đặt câu hỏi. Câu trả lời được truy xuất từ chính tài liệu của bạn kèm trích dẫn.", "Upload reports to a session, then ask questions. Answers are retrieved from your own documents, with citations.")}
          </p>

          <ul className="mt-9 space-y-3">
            {[
              ["upload_file", tr("Tải tài liệu PDF, Markdown hoặc JSON", "Upload PDF, Markdown or JSON documents"), tr("Văn bản trong PDF được đọc trực tiếp.", "Text inside PDFs is read directly.")],
              ["forum", tr("Hỏi đáp có trích dẫn", "Cited Q&A"), tr("Mỗi câu trả lời kèm tên tài liệu, số trang và đoạn trích.", "Every answer comes with the document name, page number and excerpt.")],
              ["fact_check", tr("Kiểm tra số học tự động", "Automatic arithmetic check"), tr("Đối chiếu các phép cộng trong báo cáo để phát hiện số liệu lệch.", "Cross-checks the sums in a report to catch inconsistent figures.")],
            ].map(([icon, title, desc]) => (
              <li key={title} className={`flex items-start gap-4 rounded-2xl ${glass} p-4`}>
                <span className="material-symbols-outlined grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-primary/15 text-primary">{icon}</span>
                <div>
                  <p className="font-semibold text-on-surface">{title}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-on-surface-variant">FinSight</p>
      </section>

      {/* Form panel */}
      <section className="relative z-10 flex items-center justify-center px-5 py-10 min-h-screen lg:min-h-0">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Logo size={38} />
            <span className="text-2xl font-bold tracking-tight text-gradient">FinSight</span>
          </div>

          <div role="tablist" aria-label={tr("Chế độ", "Mode")} className={`grid grid-cols-2 rounded-xl ${glass} p-1 mb-6`}>
            {[[false, tr("Đăng nhập", "Sign in")], [true, tr("Đăng ký", "Sign up")]].map(([mode, label]) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={register === mode}
                disabled={busy}
                onClick={() => switchMode(mode)}
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${register === mode ? "bg-primary/15 dark:bg-white/15 text-primary dark:text-on-surface shadow-inner" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={`rounded-3xl ${glass} p-6 sm:p-8`}>
            <h2 className="text-2xl font-bold tracking-tight">{register ? tr("Tạo tài khoản", "Create account") : tr("Chào mừng trở lại", "Welcome back")}</h2>
            <p className="mt-2 mb-6 text-sm text-on-surface-variant">
              {register ? tr("Lưu báo cáo và hội thoại trong không gian riêng của bạn.", "Keep your reports and conversations in your own private space.") : tr("Đăng nhập để tiếp tục phân tích báo cáo tài chính.", "Sign in to keep analysing financial reports.")}
            </p>

            <form onSubmit={submit} className="space-y-5" noValidate={false}>
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1.5">{tr("Tên đăng nhập", "Username")}</label>
                <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]{3,64}" disabled={busy} className={field} placeholder="ten.dang.nhap" />
                <p className="mt-1 text-xs text-on-surface-variant">{tr("3–64 ký tự: chữ không dấu, số, dấu chấm, _ hoặc -.", "3–64 characters: letters, digits, dot, _ or -.")}</p>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">{tr("Mật khẩu", "Password")}</label>
                <div className="relative">
                  <input id="password" type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} required minLength={8} maxLength={128} disabled={busy} className={`${field} pr-12`} />
                  <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? tr("Ẩn mật khẩu", "Hide password") : tr("Hiện mật khẩu", "Show password")} className="absolute right-0 top-1.5 w-8 h-8 grid place-items-center rounded-md text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[20px]">{visible ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{tr("Từ 8 đến 128 ký tự.", "8 to 128 characters.")}</p>
              </div>

              {register && (
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium mb-1.5">{tr("Nhập lại mật khẩu", "Confirm password")}</label>
                  <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} aria-invalid={Boolean(confirm) && confirm !== password} className={field} />
                  {confirm && confirm !== password && <p className="mt-1 text-xs text-error">{tr("Mật khẩu nhập lại chưa khớp.", "Passwords do not match.")}</p>}
                </div>
              )}

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-container/60 p-3 text-sm text-on-error-container">
                  <span className="material-symbols-outlined text-[18px] mt-px">error</span>{error}
                </p>
              )}

              <button type="submit" disabled={busy} className="w-full h-11 rounded-lg bg-primary text-on-primary font-semibold flex items-center justify-center gap-2">
                {busy && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                {busy ? tr("Đang xử lý...", "Working...") : register ? tr("Tạo tài khoản", "Create account") : tr("Đăng nhập", "Sign in")}
                {!busy && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-on-surface-variant"><span className="h-px flex-1 bg-outline-variant/50" />{tr("HOẶC", "OR")}<span className="h-px flex-1 bg-outline-variant/50" /></div>

            <button type="button" disabled={busy} onClick={() => navigate(destination, { replace: true })} className="w-full h-11 rounded-lg border border-primary/20 dark:border-white/25 bg-white/40 dark:bg-white/10 text-sm font-medium text-on-surface hover:bg-white/70 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              {tr("Tiếp tục với tư cách khách", "Continue as guest")}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
