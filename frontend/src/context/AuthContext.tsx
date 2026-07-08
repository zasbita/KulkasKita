import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, setAuthToken } from "@/src/api/client";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  household_id?: string | null;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  refresh: () => Promise<void>;
  signInWithSessionId: (sessionId: string) => Promise<User>;
  signOut: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "sgmp_session_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const loadStoredToken = useCallback(async () => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) {
      setAuthToken(token);
      try {
        const me = await api.get<User>("/auth/me");
        setUser(me.data);
      } catch {
        await storage.secureRemove(TOKEN_KEY);
        setAuthToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStoredToken();
  }, [loadStoredToken]);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me.data);
    } catch {
      setUser(null);
    }
  }, []);

  const signInWithSessionId = useCallback(async (sessionId: string): Promise<User> => {
    const r = await api.post<{ session_token: string; user: User }>("/auth/session", {
      session_id: sessionId,
    });
    await storage.secureSet(TOKEN_KEY, r.data.session_token);
    setAuthToken(r.data.session_token);
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ loading, user, refresh, signInWithSessionId, signOut, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
