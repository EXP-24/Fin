import { createContext, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUser() {
    setLoading(true);
    setError("");
    try {
      setUser(await api.me());
    } catch (err) {
      setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  async function logout() {
    await api.logout();
    setUser(await api.me());  // fall back to a fresh guest
  }

  return <AuthContext.Provider value={{ user, setUser, loading, error, reload: loadUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Waits for the identity (guest or member); guests may use the app. */
export function RequireAuth() {
  const { user, loading, error, reload } = useAuth();
  if (loading) return <div role="status" className="min-h-screen grid place-items-center bg-background text-on-surface">Đang kiểm tra đăng nhập...</div>;
  if (error) return <div role="alert" className="min-h-screen grid place-items-center bg-background p-6"><div className="text-center"><p className="text-error mb-4">Không thể kết nối máy chủ: {error}</p><button onClick={reload} className="rounded-xl bg-primary text-on-primary px-6 py-3">Thử lại</button></div></div>;
  return <Outlet />;
}
