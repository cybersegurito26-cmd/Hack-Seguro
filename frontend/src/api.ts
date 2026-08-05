// API client for Hack-Seguro backend.
// Reads EXPO_PUBLIC_BACKEND_URL from Expo env, appends /api,
// injects Bearer session_token stored securely.
import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "hackseguro.session_token";
export const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BASE_URL}/api`;

let inMemoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await storage.secureGet<string>(TOKEN_KEY, "");
  inMemoryToken = t || null;
  return inMemoryToken;
}

export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (token) {
    await storage.secureSet(TOKEN_KEY, token);
  } else {
    await storage.secureRemove(TOKEN_KEY);
  }
}

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const detail = (json && (json.detail || json.error)) || res.statusText;
    if (res.status === 401) {
      await setToken(null);
    }
    const err: any = new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

// ---- endpoints ----
export const api = {
  authExchange: (session_id: string) =>
    apiFetch<{ session_token: string; user: any }>("/auth/session", {
      method: "POST",
      body: { session_id },
      auth: false,
    }),
  me: () => apiFetch<{ user: any }>("/auth/me"),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  schoolByCode: (code: string) => apiFetch<any>(`/schools/${code}`, { auth: false }),
  joinSchool: (body: { school_code: string; role?: string; grade?: string; group?: string }) =>
    apiFetch<{ user: any; school: any }>("/schools/join", { method: "POST", body }),
  mySchool: () => apiFetch<{ school: any | null }>("/schools/mine"),

  progress: () => apiFetch<{ user: any }>("/progress"),
  completeLesson: (module_id: string, correct: number, total: number) =>
    apiFetch<any>("/lessons/complete", { method: "POST", body: { module_id, correct, total } }),
  completeGame: (game_id: string, score: number, total: number) =>
    apiFetch<any>("/games/complete", { method: "POST", body: { game_id, score, total } }),
  claimDaily: () => apiFetch<any>("/daily/claim", { method: "POST" }),

  weeklyLeaderboard: (scope: "school" | "global" = "school") =>
    apiFetch<{ scope: string; school_code: string | null; week_start: string; top: any[]; me: any }>(
      `/leaderboards/weekly?scope=${scope}`
    ),

  certificateUrl: async (module_id: string) => {
    const token = await getToken();
    return {
      url: `${API_URL}/certificates/${module_id}`,
      token,
    };
  },

  chat: (session_id: string, message: string) =>
    apiFetch<{ reply: string }>("/chatbot", { method: "POST", body: { session_id, message } }),
  chatHistory: (session_id: string) =>
    apiFetch<{ messages: any[] }>(`/chatbot/history?session_id=${encodeURIComponent(session_id)}`),

  teacherRoster: () => apiFetch<{ school_code: string | null; groups: any[] }>("/teacher/roster"),
};
