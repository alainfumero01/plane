import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/app/lib/auth-context";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="public-page">
      <form
        className="public-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setBusy(true);

          void signIn(email, password)
            .then(() => navigate("/dashboard"))
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Sign in failed.");
            })
            .finally(() => setBusy(false));
        }}
      >
        <p className="public-card__kicker">AIDA Access</p>
        <h1>Login</h1>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>

        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>

        {error ? <p className="message message--error">{error}</p> : null}
        {!loading && !email && !password ? (
          <p className="message">Use your Supabase credentials. Configure `.env` if running locally.</p>
        ) : null}

        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Signing in..." : "Sign In"}
        </button>

        <p className="message">
          Need an account? <Link to="/sign-up">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
