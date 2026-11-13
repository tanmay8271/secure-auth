// Keeps the logged-in user and token for the whole app.
// The token is stored in sessionStorage: it is gone when the tab closes.
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const read = () => {
  try {
    return sessionStorage.getItem("token");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(read);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(read()));

  // On load, ask the server who this token belongs to. An expired token logs the user out.
  useEffect(() => {
    if (!token) return setChecking(false);
    api("/me", { token })
      .then((d) => setUser(d.user))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line

  const save = (d) => {
    try {
      sessionStorage.setItem("token", d.token);
    } catch {}
    setToken(d.token);
    setUser(d.user);
  };
  const login = async (email, password) => save(await api("/auth/login", { method: "POST", body: { email, password } }));
  const register = async (name, email, password) => save(await api("/auth/register", { method: "POST", body: { name, email, password } }));
  const logout = () => {
    try {
      sessionStorage.removeItem("token");
    } catch {}
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, token, checking, login, register, logout }}>{children}</Ctx.Provider>;
}
