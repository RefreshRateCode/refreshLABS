import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) {
    navigate("/", { replace: true });
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="noalanPRO"
            className="only-dark h-11 w-auto"
          />
          <img
            src="/noalanpro-black.png"
            alt="noalanPRO"
            className="only-light h-9 w-auto"
          />
          <p className="mt-3 text-sm text-muted">Sign in to your workspace.</p>
        </div>

        <label className="mb-1 block text-sm font-medium text-content">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        <label className="mb-1 block text-sm font-medium text-content">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        {error && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-black transition hover:bg-brand-light disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
