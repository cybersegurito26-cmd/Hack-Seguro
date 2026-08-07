import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

import { api, getToken, setToken, AuthRole } from "@/src/api";
import { registerForPush } from "@/src/push";
import { captureIncomingReferral, consumePendingReferral } from "@/src/referrals";

WebBrowser.maybeCompleteAuthSession();

export type AppUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  role: "student" | "teenager" | "parent" | "teacher";
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
  referrals_valid?: number;
  referrals_pending?: number;
  invited_by_user_id?: string | null;
};

type Ctx = {
  loading: boolean;
  user: AppUser | null;
  refresh: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<AppUser>;
  signUpWithEmail: (name: string, email: string, password: string, role: AuthRole) => Promise<AppUser>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, new_password: string) => Promise<AppUser>;
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

async function applyAuthResponse(
  res: { session_token: string; user: any },
  setUser: (u: AppUser | null) => void
): Promise<AppUser> {
  await setToken(res.session_token);
  setUser(res.user);
  if (res.user?.user_id) {
    registerForPush(res.user.user_id).catch(() => {});
  }
  return res.user;
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
      if (res.user?.user_id) {
        registerForPush(res.user.user_id).catch(() => {});
      }
    } catch {
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (session_id: string): Promise<AppUser | null> => {
    if (!session_id || usedSessionIds.has(session_id)) return null;
    usedSessionIds.add(session_id);
    try {
      const ref = await consumePendingReferral();
      const res = await api.authExchange(session_id, ref);
      return await applyAuthResponse(res, setUser);
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

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AppUser> => {
      const res = await api.authLogin(email.trim().toLowerCase(), password);
      return applyAuthResponse(res, setUser);
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string, role: AuthRole): Promise<AppUser> => {
      const ref = await consumePendingReferral();
      const res = await api.authRegister({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        ref,
      });
      return applyAuthResponse(res, setUser);
    },
    []
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    await api.authForgot(email.trim().toLowerCase());
  }, []);

  const resetPassword = useCallback(
    async (email: string, code: string, new_password: string): Promise<AppUser> => {
      const res = await api.authReset(email.trim().toLowerCase(), code.trim(), new_password);
      return applyAuthResponse(res, setUser);
    },
    []
  );

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
        // Capture ambassador ref BEFORE we clean the URL
        await captureIncomingReferral();
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const raw = window.location.hash + " " + window.location.search;
          const sid = extractSessionId(raw);
          if (sid) {
            await processSessionId(sid);
          }
          // clean URL params consumed by the app (session_id, ref, code)
          try {
            const url = new URL(window.location.href);
            let dirty = false;
            for (const key of ["session_id", "ref", "code"]) {
              if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                dirty = true;
              }
            }
            if (url.hash) {
              url.hash = "";
              dirty = true;
            }
            if (dirty) {
              window.history.replaceState(window.history.state, "", url.pathname + url.search);
            }
          } catch {}
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
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    resetPassword,
    processSessionId,
    logout,
    setUserLocal: setUser,
  }), [loading, user, refresh, loginWithGoogle, signInWithEmail, signUpWithEmail, requestPasswordReset, resetPassword, processSessionId, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
