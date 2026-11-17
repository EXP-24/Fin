import { Component } from "react";

/** Catches render errors so a bug in one page never leaves a blank screen. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen grid place-items-center p-6 text-on-surface">
        <div className="max-w-md w-full rounded-2xl border border-error/40 bg-surface-container-low/90 backdrop-blur-xl p-8 text-center">
          <span className="material-symbols-outlined text-[44px] text-error">report</span>
          <h1 className="mt-3 text-xl font-semibold">Đã xảy ra lỗi hiển thị</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Ứng dụng gặp sự cố ngoài dự kiến. Dữ liệu của bạn trên máy chủ không bị ảnh hưởng.</p>
          <p className="mt-3 text-xs text-on-surface-variant break-words font-mono">{String(this.state.error?.message || this.state.error)}</p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="h-10 px-5 rounded-lg bg-primary text-on-primary text-sm font-semibold">Tải lại trang</button>
            <button type="button" onClick={() => { window.location.href = "/"; }} className="h-10 px-5 rounded-lg border border-outline-variant/70 text-sm">Về trang chủ</button>
          </div>
        </div>
      </div>
    );
  }
}
