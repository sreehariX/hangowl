"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  personaName: string | null;
}

interface AuthContextValue extends AuthState {
  loading: boolean;
  login: (userId: string, personaName: string, token?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredAuth(): AuthState {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, userId: null, personaName: null };
  }
  const userId = localStorage.getItem("hangowl_user_id");
  const personaName = localStorage.getItem("hangowl_persona");
  if (userId && personaName) {
    return { isAuthenticated: true, userId, personaName };
  }
  return { isAuthenticated: false, userId: null, personaName: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    userId: null,
    personaName: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setState(getStoredAuth());
    setLoading(false);
  }, []);

  const login = useCallback((userId: string, personaName: string, token?: string) => {
    localStorage.setItem("hangowl_user_id", userId);
    localStorage.setItem("hangowl_persona", personaName);
    if (token) localStorage.setItem("hangowl_token", token);
    setState({ isAuthenticated: true, userId, personaName });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hangowl_user_id");
    localStorage.removeItem("hangowl_persona");
    localStorage.removeItem("hangowl_token");
    setState({ isAuthenticated: false, userId: null, personaName: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
