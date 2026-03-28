import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    async function createToken() {
      try {
        const res = await apiRequest("POST", "/api/plaid/create-link-token");
        const data = await res.json();
        setLinkToken(data.link_token);
      } catch (err) {
        console.error("Failed to create link token:", err);
        setStatus("Failed to initialize — check Plaid credentials");
      }
    }
    createToken();
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setLoading(true);
    setStatus("Linking account...");
    try {
      const res = await apiRequest("POST", "/api/plaid/exchange-token", {
        public_token: publicToken,
      });
      const data = await res.json();
      setStatus(`Linked: ${data.institutionName}`);
      // Invalidate holdings cache to trigger a fresh fetch
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] });
    } catch (err) {
      console.error("Exchange failed:", err);
      setStatus("Failed to link account");
    }
    setLoading(false);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => open()}
        disabled={!ready || loading}
        data-testid="button-plaid-link"
        className="px-4 py-2 bg-[var(--terminal-amber)]/20 border border-[var(--terminal-amber)]/50 text-[var(--terminal-amber)]
                   font-mono text-[11px] tracking-wider hover:bg-[var(--terminal-amber)]/30 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed rounded"
      >
        {loading ? "LINKING..." : "+ LINK BROKERAGE"}
      </button>
      {status && (
        <span className="text-[10px] text-[var(--terminal-dim)]">{status}</span>
      )}
    </div>
  );
}
