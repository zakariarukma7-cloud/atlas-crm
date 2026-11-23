import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      setErrorMsg("Email atau password salah. Pastikan user sudah dibuat di Supabase.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0B0B",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        color: "#F5F5F5",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#141414",
          border: "1px solid #262626",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Logo Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#F5F5F5",
              color: "#0B0B0B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "16px",
            }}
          >
            A
          </span>
          <span style={{ fontSize: "20px", fontWeight: "700" }}>
            atlas<span style={{ color: "#737373", fontWeight: "400" }}>.crm</span>
          </span>
        </div>

        <h2 style={{ margin: "0 0 6px 0", fontSize: "20px" }}>
          Sign in to Workspace
        </h2>
        <p style={{ margin: "0 0 24px 0", fontSize: "13px", color: "#888" }}>
          Masukkan akun administrator untuk mengelola data CRM.
        </p>

        {errorMsg && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#FCA5A5",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                marginBottom: "6px",
                color: "#CCC",
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="admin@atlascrm.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: "#0B0B0B",
                color: "#FFF",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                marginBottom: "6px",
                color: "#CCC",
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: "#0B0B0B",
                color: "#FFF",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "6px",
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: "#F5F5F5",
              color: "#0B0B0B",
              fontWeight: "600",
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}