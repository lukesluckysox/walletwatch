import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  email: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    userId: null,
    email: null,
    loading: true,
  });

  // Check session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setState({
        isLoggedIn: true,
        userId: data.userId,
        email: data.email || null,
        loading: false,
      });
    } catch {
      setState({ isLoggedIn: false, userId: null, email: null, loading: false });
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      setState({
        isLoggedIn: true,
        userId: data.user.id,
        email: data.user.email,
        loading: false,
      });
      return { success: true };
    } catch (err: any) {
      const msg = err.message?.includes("401")
        ? "Invalid credentials"
        : "Login failed";
      return { success: false, error: msg };
    }
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiRequest("POST", "/api/auth/register", { email, password });
      const data = await res.json();
      setState({
        isLoggedIn: true,
        userId: data.user.id,
        email: data.user.email,
        loading: false,
      });
      return { success: true };
    } catch (err: any) {
      const msg = err.message?.includes("409")
        ? "Email already registered"
        : err.message?.includes("400")
        ? "Email and password (min 8 chars) required"
        : "Registration failed";
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // Ignore — still clear local state
    }
    setState({ isLoggedIn: false, userId: null, email: null, loading: false });
  }, []);

  return { ...state, login, register, logout, checkAuth };
}
