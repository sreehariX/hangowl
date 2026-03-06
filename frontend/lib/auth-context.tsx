"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
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

const serverSnapshot: AuthState = {
  isAuthenticated: false,
  userId: null,
  personaName: null,
};

let listeners: (() => void)[] = [];
let currentSnapshot = serverSnapshot;

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getServerSnapshot() {
  return serverSnapshot;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, () => {
    if (currentSnapshot === serverSnapshot) {
      currentSnapshot = getStoredAuth();
    }
    return currentSnapshot;
  }, getServerSnapshot);

  const [loading] = useState(false);

  const login = useCallback((userId: string, personaName: string, token?: string) => {
    localStorage.setItem("hangowl_user_id", userId);
    localStorage.setItem("hangowl_persona", personaName);
    if (token) localStorage.setItem("hangowl_token", token);
    currentSnapshot = { isAuthenticated: true, userId, personaName };
    emitChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hangowl_user_id");
    localStorage.removeItem("hangowl_persona");
    localStorage.removeItem("hangowl_token");
    currentSnapshot = { isAuthenticated: false, userId: null, personaName: null };
    emitChange();
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
