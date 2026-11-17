import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useLanguage } from "../i18n.jsx";
import { useToast } from "../components/Toast.jsx";
import { getEffects, getTheme, setEffects, setTheme } from "../theme.js";

function Section({ icon, title, desc, children }) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="material-symbols-outlined grid place-items-center w-8 h-8 text-[18px] rounded-lg bg-primary/15 text-primary">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          {desc && <p className="text-sm text-on-surface-variant mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-outline-variant/60 p-1 gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${value === o.value ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-primary/10"}`}
        >
          {o.icon && <span className="material-symbols-outlined text-[18px]">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { lang, setLang, tr } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const isMember = user?.status === "member";
  const [theme, setThemeState] = useState(getTheme);
  const [fx, setFx] = useState(getEffects);

  useEffect(() => {
    const sync = () => { setThemeState(getTheme()); setFx(getEffects()); };
    window.addEventListener("finsight:prefs", sync);
    return () => window.removeEventListener("finsight:prefs", sync);
  }, []);

  async function onLogout() {
    try {
      await logout();
      toast.success(tr("Đã đăng xuất.", "Signed out."));
      navigate("/login");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="w-full max-w-3xl px-margin-mobile md:px-0 py-10 pb-24 space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{tr("Tài khoản", "Account")}</p>
        <h1 className="mt-1 text-headline-md font-headline-md text-on-surface">{tr("Cài đặt", "Settings")}</h1>
      </header>

      <Section icon="person" title={tr("Tài khoản", "Account")} desc={isMember ? (tr("Bạn đang đăng nhập bằng tài khoản thành viên.", "You are signed in as a member.")) : (tr("Bạn đang dùng chế độ khách.", "You are in guest mode."))}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="w-14 h-14 rounded-full grid place-items-center text-xl font-bold text-white bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400">
            {(user?.username || "K").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-on-surface">{user?.username || (tr("Khách", "Guest"))}</p>
            <p className={`mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${isMember ? "border-secondary/40 text-secondary bg-secondary/10" : "border-outline-variant/60 text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-[14px]">{isMember ? "verified_user" : "person_outline"}</span>
              {isMember ? (tr("Thành viên", "Member")) : (tr("Khách", "Guest"))}
            </p>
          </div>
          {isMember ? (
            <button type="button" onClick={onLogout} className="h-10 px-4 rounded-lg border border-error/50 text-error text-sm font-medium inline-flex items-center gap-2 hover:bg-error/10">
              <span className="material-symbols-outlined text-[18px]">logout</span>{tr("Đăng xuất", "Sign out")}
            </button>
          ) : (
            <button type="button" onClick={() => navigate("/login")} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">login</span>{tr("Đăng nhập / Đăng ký", "Sign in / Sign up")}
            </button>
          )}
        </div>
      </Section>

      <Section icon="palette" title={tr("Giao diện", "Appearance")} desc={tr("Lựa chọn được lưu trên trình duyệt này.", "Saved in this browser.")}>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-on-surface mb-2">{tr("Chế độ màu", "Color mode")}</p>
            <Segmented
              label={tr("Chế độ màu", "Color mode")}
              value={theme}
              onChange={(v) => { setTheme(v); toast.info(tr("Đã đổi giao diện.", "Theme updated.")); }}
              options={[
                { value: "dark", icon: "dark_mode", label: tr("Tối", "Dark") },
                { value: "light", icon: "light_mode", label: tr("Sáng", "Light") },
                { value: "system", icon: "contrast", label: tr("Theo hệ thống", "System") },
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface mb-2">{tr("Ngôn ngữ", "Language")}</p>
            <Segmented
              label={tr("Ngôn ngữ", "Language")}
              value={lang}
              onChange={setLang}
              options={[{ value: "VN", label: "Tiếng Việt" }, { value: "EN", label: "English" }]}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/50 p-4">
            <div>
              <p className="text-sm font-medium text-on-surface">{tr("Hiệu ứng nền thiên hà", "Galaxy background effects")}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{tr("Sao chuyển động, hiệu ứng theo chuột và ánh sáng trên thẻ. Tắt nếu máy chậm hoặc bạn thấy khó chịu.", "Moving stars, cursor effects and card glow. Turn off on slow devices.")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fx}
              aria-label={tr("Hiệu ứng nền thiên hà", "Galaxy background effects")}
              onClick={() => setEffects(!fx)}
              className={`relative w-12 h-7 shrink-0 rounded-full border transition-colors ${fx ? "bg-primary border-primary" : "bg-surface-container-high border-outline-variant"}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${fx ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </Section>

      <Section icon="keyboard" title={tr("Phím tắt", "Keyboard shortcuts")}>
        <ul className="text-sm divide-y divide-outline-variant/40">
          {[
            [tr("Tìm kiếm nhanh / mở bảng lệnh", "Quick search / command palette"), ["Ctrl", "K"]],
            [tr("Gửi câu hỏi trong chat", "Send chat message"), ["Enter"]],
            [tr("Xuống dòng trong chat", "New line in chat"), ["Shift", "Enter"]],
            [tr("Đóng hộp thoại", "Close dialog"), ["Esc"]],
          ].map(([label, keys]) => (
            <li key={label} className="flex items-center justify-between py-2.5">
              <span className="text-on-surface-variant">{label}</span>
              <span className="flex gap-1">{keys.map((k) => <kbd key={k} className="rounded border border-outline-variant/70 bg-surface-container/60 px-2 py-0.5 text-xs text-on-surface">{k}</kbd>)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
