import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import usersData from "../../data/users.json";
import { useAuth } from "../../auth/AuthContext";
import "./Login.css";

export default function Login() {
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const match = usersData.users.find(
      (u) => u.id === id.trim() && u.password === pwd
    );

    if (!match) {
      setError("Invalid ID or password.");
      return;
    }

    // Store only safe fields
    login({ id: match.id, name: match.name });
    navigate("/landing");
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>PaperTrail</h1>
        <p className="muted">Sign in to continue</p>

        <label htmlFor="id">ID</label>
        <input
          id="id"
          type="text"
          placeholder="you@example.com"
          value={id}
          onChange={(e) => setId(e.target.value)}
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
          autoComplete="current-password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="login-btn">
          Log In
        </button>
      </form>
    </div>
  );
}
