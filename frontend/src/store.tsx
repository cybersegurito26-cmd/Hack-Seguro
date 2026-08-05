// Store: thin action layer that calls the backend and updates the auth user.
// Reads user state from AuthProvider.
import React, { createContext, useContext, useCallback, useMemo } from "react";
import { api } from "@/src/api";
import { useAuth, AppUser } from "@/src/auth";

type Actions = {
  addXPCoinsFromLesson: (moduleId: string, correct: number, total: number) => Promise<any>;
  completeGame: (gameId: string, score: number, total: number) => Promise<any>;
  claimDaily: () => Promise<any>;
  joinSchool: (code: string, grade?: string, group?: string, role?: string) => Promise<any>;
};

type Store = {
  user: AppUser | null;
} & Actions;

const XP_PER_LEVEL = 100;
const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, setUserLocal } = useAuth();

  const addXPCoinsFromLesson = useCallback(async (moduleId: string, correct: number, total: number) => {
    const res = await api.completeLesson(moduleId, correct, total);
    if (res?.user) setUserLocal(res.user);
    return res;
  }, [setUserLocal]);

  const completeGame = useCallback(async (gameId: string, score: number, total: number) => {
    const res = await api.completeGame(gameId, score, total);
    if (res?.user) setUserLocal(res.user);
    return res;
  }, [setUserLocal]);

  const claimDaily = useCallback(async () => {
    const res = await api.claimDaily();
    if (res?.user) setUserLocal(res.user);
    return res;
  }, [setUserLocal]);

  const joinSchool = useCallback(async (code: string, grade?: string, group?: string, role?: string) => {
    const res = await api.joinSchool({ school_code: code, grade, group, role });
    if (res?.user) setUserLocal(res.user);
    return res;
  }, [setUserLocal]);

  const value = useMemo<Store>(() => ({
    user,
    addXPCoinsFromLesson,
    completeGame,
    claimDaily,
    joinSchool,
  }), [user, addXPCoinsFromLesson, completeGame, claimDaily, joinSchool]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export { XP_PER_LEVEL };
