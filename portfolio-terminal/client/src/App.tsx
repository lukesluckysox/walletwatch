import { Switch, Route, Router, useLocation, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import PortfolioPage from "@/pages/portfolio";
import TradingPage from "@/pages/trading";
import OptionsPage from "@/pages/options";
import SectorPage from "@/pages/sectors";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { apiRequest } from "@/lib/queryClient";

// Auth context
interface AuthContextType {
  isLoggedIn: boolean;
  loading: boolean;
  email: string;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  loading: true,
  email: "",
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");

  // Check session on mount
  useEffect(() => {
    apiRequest("GET", "/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setIsLoggedIn(true);
        setEmail(data.email || data.userId || "");
      })
      .catch(() => {
        setIsLoggedIn(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      setIsLoggedIn(true);
      setEmail(data.user.email);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message?.includes("401") ? "Invalid credentials" : "Login failed",
      };
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", { email, password });
      const data = await res.json();
      setIsLoggedIn(true);
      setEmail(data.user.email);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message?.includes("409")
          ? "Email already registered"
          : err.message?.includes("400")
          ? "Email and password (min 8 chars) required"
          : "Registration failed",
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setIsLoggedIn(false);
    setEmail("");
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, loading, email, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const { isLoggedIn, logout, email } = useAuth();

  const navItems = [
    { path: "/", label: "PORTFOLIO", icon: "◈", shortcut: "F1" },
    { path: "/trading", label: "TRADE?", icon: "◆", shortcut: "F2" },
    { path: "/options", label: "OPTIONS", icon: "◇", shortcut: "F3" },
    { path: "/sectors", label: "SECTORS", icon: "◉", shortcut: "F4" },
  ];

  return (
    <div className="w-[200px] min-w-[200px] h-full flex flex-col bg-[hsl(220,20%,5%)] border-r border-[hsl(220,15%,14%)]">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[hsl(220,15%,14%)]">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Terminal logo">
            <rect x="2" y="2" width="24" height="24" rx="3" stroke="hsl(35,100%,50%)" strokeWidth="1.5" />
            <path d="M8 10l4 4-4 4" stroke="hsl(35,100%,50%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="14" y1="18" x2="20" y2="18" stroke="hsl(35,100%,50%)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-[var(--terminal-amber)]">TERMINAL</div>
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)]">PORTFOLIO v2.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const isRoot = item.path === "/" && location === "/";
          const active = isActive || isRoot;
          return (
            <Link key={item.path} href={item.path}>
              <div
                data-testid={`nav-${item.label.toLowerCase().replace('?', '')}`}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded cursor-pointer text-[11px] font-medium tracking-wider transition-colors ${
                  active
                    ? "bg-[hsl(35,100%,50%,0.12)] text-[var(--terminal-amber)] border-l-2 border-[var(--terminal-amber)]"
                    : "text-[var(--terminal-dim)] hover:text-[hsl(60,5%,75%)] hover:bg-[hsl(220,15%,10%)]"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-[9px] opacity-50">{item.shortcut}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Status bar */}
      <div className="px-4 py-3 border-t border-[hsl(220,15%,14%)] space-y-2">
        {isLoggedIn && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--terminal-green)] pulse-glow" />
              <span className="text-[9px] tracking-wider text-[var(--terminal-dim)] truncate max-w-[100px]">
                {email.toUpperCase()}
              </span>
            </div>
            <button
              onClick={logout}
              data-testid="button-logout"
              className="text-[9px] tracking-wider text-[var(--terminal-dim)] hover:text-[var(--terminal-red)] transition-colors"
            >
              LOGOUT
            </button>
          </div>
        )}
        <div className="text-[9px] tracking-wider text-[var(--terminal-dim)]">
          MKT {new Date().toLocaleTimeString("en-US", { hour12: false })} EST
        </div>
        <PerplexityAttribution />
      </div>
    </div>
  );
}

function AppLayout() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="text-[var(--terminal-amber)] text-[11px] tracking-widest animate-pulse">
          INITIALIZING TERMINAL...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={PortfolioPage} />
          <Route path="/trading" component={TradingPage} />
          <Route path="/options" component={OptionsPage} />
          <Route path="/sectors" component={SectorPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppLayout />
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
