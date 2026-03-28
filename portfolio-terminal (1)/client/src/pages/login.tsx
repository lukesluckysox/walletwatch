import { useState } from "react";
import { useAuth } from "@/App";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result =
      mode === "login"
        ? await login(email, password)
        : await register(email, password);

    setLoading(false);
    if (!result.success) {
      setError(result.error || "AUTHENTICATION FAILED");
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-[hsl(220,20%,6%)]">
      <div className="w-[380px] border border-[hsl(220,15%,16%)] bg-[hsl(220,18%,8%)] rounded">
        {/* Header bar */}
        <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--terminal-amber)]" />
          <span className="text-[10px] font-bold tracking-widest text-[var(--terminal-amber)]">
            {mode === "login" ? "AUTHENTICATION REQUIRED" : "CREATE ACCOUNT"}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-[10px] tracking-wider text-[var(--terminal-dim)] mb-4">
            {mode === "login"
              ? "ENTER CREDENTIALS TO ACCESS PORTFOLIO DATA"
              : "REGISTER TO START TRACKING YOUR PORTFOLIO"}
          </div>

          <div>
            <label className="block text-[10px] tracking-wider text-[var(--terminal-dim)] mb-1.5">
              EMAIL
            </label>
            <input
              data-testid="input-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[hsl(220,20%,5%)] border border-[hsl(220,15%,18%)] rounded px-3 py-2 text-[12px] font-mono text-[hsl(60,5%,90%)] focus:outline-none focus:border-[var(--terminal-amber)] transition-colors"
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-wider text-[var(--terminal-dim)] mb-1.5">
              PASSWORD
            </label>
            <input
              data-testid="input-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[hsl(220,20%,5%)] border border-[hsl(220,15%,18%)] rounded px-3 py-2 text-[12px] font-mono text-[hsl(60,5%,90%)] focus:outline-none focus:border-[var(--terminal-amber)] transition-colors"
              placeholder={mode === "register" ? "Min 8 characters" : ""}
            />
          </div>

          {error && (
            <div className="text-[10px] tracking-wider text-[var(--terminal-red)] bg-[hsl(0,72%,51%,0.08)] px-3 py-2 rounded border border-[hsl(0,72%,51%,0.2)]">
              ✗ {error}
            </div>
          )}

          <button
            data-testid="button-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--terminal-amber)] text-[hsl(220,20%,6%)] text-[11px] font-bold tracking-widest rounded hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading
              ? "AUTHENTICATING..."
              : mode === "login"
              ? "LOGIN →"
              : "CREATE ACCOUNT →"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="text-[10px] tracking-wider text-[var(--terminal-dim)] hover:text-[var(--terminal-amber)] transition-colors"
            >
              {mode === "login"
                ? "NEW USER? CREATE ACCOUNT"
                : "HAVE AN ACCOUNT? LOGIN"}
            </button>
          </div>

          <div className="text-[9px] text-center text-[var(--terminal-dim)] tracking-wider">
            SECURE TERMINAL SESSION · ENCRYPTED
          </div>
        </form>
      </div>
    </div>
  );
}
