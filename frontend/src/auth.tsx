import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { api, getToken, setToken } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

export type AppUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: "student" | "parent" | "teacher";
  school_code?: string | null;
  grade?: string | null;
  group?: string | null;
  xp: number;
  coins: number;
  level: number;
  hearts: number;
  streak: number;
  daily_claim_date?: string | null;
  completed_lessons: Record<string, number>;
  badges: string[];
};

type Ctx = {
  loading: boolean;
  user: AppUser | null;
  refresh: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  processSessionId: (session_id: string) => Promise<AppUser | null>;
  logout: () => Promise<void>;
  setUserLocal: (u: AppUser | null) => void;
};

const AuthCtx = createContext<Ctx | null>(null);

const usedSessionIds = new Set<string>();

function extractSessionId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const m = rawUrl.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const router = useRouter();
  const processing = useRef(false);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (session_id: string): Promise<AppUser | null> => {
    if (!session_id || usedSessionIds.has(session_id)) return null;
    usedSessionIds.add(session_id);
    try {
      const res = await api.authExchange(session_id);
      await setToken(res.session_token);
      setUser(res.user);
      return res.user;
    } catch (e) {
      console.warn("auth exchange failed", e);
      return null;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const redirect = Platform.OS === "web"
      ? (typeof window !== "undefined" ? window.location.origin + "/" : "")
      : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.location.href = authUrl;
      }
      return;
    }

    // Native: capture deep link before opening
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", (event) => {
      captured = event.url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      let url: string | null = null;
      if (result.type === "success" && (result as any).url) {
        url = (result as any).url;
      }
      if (!url) url = captured;
      if (!url) url = await Linking.getInitialURL();
      const sid = extractSessionId(url);
      if (sid) {
        await processSessionId(sid);
      }
    } finally {
      sub.remove();
    }
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    await setToken(null);
    setUser(null);
    router.replace("/");
  }, [router]);

  // On mount: web handles session_id in URL, mobile handles cold-start deep link
  useEffect(() => {
    (async () => {
      if (processing.current) return;
      processing.current = true;
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const raw = window.location.hash + " " + window.location.search;
          const sid = extractSessionId(raw);
          if (sid) {
            await processSessionId(sid);
            // clean URL
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.pathname + url.search);
            } catch {}
          }
        } else if (Platform.OS !== "web") {
          const initial = await Linking.getInitialURL();
          const sid = extractSessionId(initial);
          if (sid) await processSessionId(sid);
        }
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, processSessionId]);

  const value = useMemo<Ctx>(() => ({
    loading,
    user,
    refresh,
    loginWithGoogle,
    processSessionId,
    logout,
    setUserLocal: setUser,
  }), [loading, user, refresh, loginWithGoogle, processSessionId, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
