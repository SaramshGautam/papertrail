import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./login.css";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState(""); // only for signup
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const cleanEmail = email.trim();

      if (mode === "signup") {
        // creates Firebase Auth user + Firestore /users/{uid} doc (inside AuthContext)
        await signup(cleanEmail, pwd, name.trim());
      } else {
        await login(cleanEmail, pwd);
      }

      navigate("/landing");
    } catch (err) {
      const code = err?.code || "";

      if (code === "auth/email-already-in-use")
        setError("Email is already in use.");
      else if (code === "auth/invalid-email")
        setError("Invalid email address.");
      else if (code === "auth/weak-password")
        setError("Password must be at least 6 characters.");
      else if (code === "auth/user-not-found")
        setError("No account found with that email.");
      else if (code === "auth/wrong-password") setError("Wrong password.");
      else setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>PaperTrail</h1>
        <p className="muted">
          {mode === "signup" ? "Create an account" : "Sign in to continue"}
        </p>

        {mode === "signup" && (
          <>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="pwd">Password</label>
        <input
          id="pwd"
          type="password"
          placeholder="••••••••"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? "Please wait..." : mode === "signup" ? "Sign Up" : "Log In"}
        </button>

        <div style={{ marginTop: 12, textAlign: "center" }}>
          {mode === "signup" ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode("login")}
              disabled={busy}
            >
              Already have an account? Log in
            </button>
          ) : (
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode("signup")}
              disabled={busy}
            >
              New here? Create an account
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
