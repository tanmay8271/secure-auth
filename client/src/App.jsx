import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth.jsx";

// Wraps a page that needs a login. Visitors are sent to /login and returned afterwards.
function Protected({ children }) {
  const { user, checking } = useAuth();
  const loc = useLocation();
  if (checking) return <p className="muted">Checking your session…</p>;
  return user ? children : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
}

function AuthForm({ mode }) {
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from || "/dashboard";
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isReg = mode === "register";

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      isReg ? await register(f.name, f.email, f.password) : await login(f.email, f.password);
      nav(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="card">
      <h1>{isReg ? "Create account" : "Log in"}</h1>
      {isReg && (
        <label>Name<input value={f.name} onChange={set("name")} autoComplete="name" required maxLength={60} /></label>
      )}
      <label>Email<input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>
      <label>
        Password
        <input type="password" value={f.password} onChange={set("password")} autoComplete={isReg ? "new-password" : "current-password"} required minLength={isReg ? 8 : 1} maxLength={72} />
      </label>
      {isReg && <small>At least 8 characters, with a letter and a number.</small>}
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Please wait…" : isReg ? "Create account" : "Log in"}</button>
      <p>{isReg ? <>Have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}</p>
    </form>
  );
}

function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="card">
      <h1>Hello, {user.name}</h1>
      <p>You are logged in as <strong>{user.email}</strong>. Only logged-in users can see this page, and the server checks your token again on every request.</p>
    </div>
  );
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <header>
        <Link to="/" className="brand">Secure Auth</Link>
        <nav>
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<div className="card"><h1>Secure Authentication System</h1><p>Register, log in, and open a page that only logged-in users can see.</p></div>} />
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/register" element={<AuthForm mode="register" />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="*" element={<div className="card"><h1>Page not found</h1></div>} />
        </Routes>
      </main>
    </>
  );
}
