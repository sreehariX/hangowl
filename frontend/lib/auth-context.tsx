"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  personaName: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (userId: string, personaName: string, token?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): Omit<AuthState, "loading"> {
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

const SERVER_SNAPSHOT: AuthState = {
  isAuthenticated: false,
  userId: null,
  personaName: null,
  loading: true,
};

let clientSnapshot: AuthState | null = null;
let listeners: (() => void)[] = [];

function getServerSnapshot(): AuthState {
  return SERVER_SNAPSHOT;
}

function getClientSnapshot(): AuthState {
  if (!clientSnapshot) {
    clientSnapshot = { ...readStorage(), loading: false };
  }
  return clientSnapshot;
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const login = useCallback((userId: string, personaName: string, token?: string) => {
    localStorage.setItem("hangowl_user_id", userId);
    localStorage.setItem("hangowl_persona", personaName);
    if (token) localStorage.setItem("hangowl_token", token);
    clientSnapshot = { isAuthenticated: true, userId, personaName, loading: false };
    emitChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hangowl_user_id");
    localStorage.removeItem("hangowl_persona");
    localStorage.removeItem("hangowl_token");
    clientSnapshot = { isAuthenticated: false, userId: null, personaName: null, loading: false };
    emitChange();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
