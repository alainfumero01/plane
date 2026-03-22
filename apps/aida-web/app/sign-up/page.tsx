import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/lib/auth-context";

export default function SignUpPage() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="public-page">
      <form
        className="public-card"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          setStatus(null);

          void (async () => {
            try {
              await signUp(email, password, fullName);
              setStatus(
                `Account created for ${fullName || email}. Sign in and AIDA will guide you through company onboarding in the browser.`
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign up failed.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <p className="public-card__kicker">AIDA Onboarding</p>
        <h1>Sign Up</h1>

        <label>
          Full name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} type="text" required />
        </label>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>

        <label>
          Company name
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            type="text"
            placeholder="Appia Wind Services"
          />
        </label>

        {status ? <p className="message message--success">{status}</p> : null}
        {error ? <p className="message message--error">{error}</p> : null}

        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>

        <p className="message">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
