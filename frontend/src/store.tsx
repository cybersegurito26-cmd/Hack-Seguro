import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { ProfileType, BADGES, Badge } from "./mock";

type AccessibilityPrefs = {
  largeText: boolean;
  highContrast: boolean;
};

type State = {
  profile: ProfileType | null;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  coins: number;
  streak: number;
  hearts: number;
  completedLessons: Record<string, number>; // moduleId -> lessons completed
  badges: Badge[];
  dailyClaimed: boolean;
  a11y: AccessibilityPrefs;
};

type Actions = {
  setProfile: (p: ProfileType, name?: string) => void;
  addXP: (amount: number) => void;
  addCoins: (amount: number) => void;
  loseHeart: () => void;
  completeLesson: (moduleId: string) => void;
  unlockBadge: (id: string) => void;
  claimDaily: () => void;
  toggleLargeText: () => void;
  toggleHighContrast: () => void;
  reset: () => void;
};

const XP_PER_LEVEL = 100;

const initial: State = {
  profile: null,
  name: "Explorador",
  avatar: "shield-checkmark",
  xp: 40,
  level: 1,
  coins: 25,
  streak: 3,
  hearts: 5,
  completedLessons: {},
  badges: BADGES,
  dailyClaimed: false,
  a11y: { largeText: false, highContrast: false },
};

const Ctx = createContext<(State & Actions) | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);

  const addXP = useCallback((amount: number) => {
    setState((s) => {
      const newXp = s.xp + amount;
      const newLevel = Math.max(1, Math.floor(newXp / XP_PER_LEVEL) + 1);
      return { ...s, xp: newXp, level: newLevel };
    });
  }, []);

  const addCoins = useCallback((amount: number) => {
    setState((s) => ({ ...s, coins: s.coins + amount }));
  }, []);

  const loseHeart = useCallback(() => {
    setState((s) => ({ ...s, hearts: Math.max(0, s.hearts - 1) }));
  }, []);

  const completeLesson = useCallback((moduleId: string) => {
    setState((s) => ({
      ...s,
      completedLessons: {
        ...s.completedLessons,
        [moduleId]: (s.completedLessons[moduleId] || 0) + 1,
      },
    }));
  }, []);

  const unlockBadge = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      badges: s.badges.map((b) => (b.id === id ? { ...b, unlocked: true } : b)),
    }));
  }, []);

  const claimDaily = useCallback(() => {
    setState((s) => {
      if (s.dailyClaimed) return s;
      return { ...s, dailyClaimed: true, coins: s.coins + 15, xp: s.xp + 20 };
    });
  }, []);

  const setProfile = useCallback((p: ProfileType, name?: string) => {
    setState((s) => ({ ...s, profile: p, name: name || s.name }));
  }, []);

  const toggleLargeText = useCallback(() => {
    setState((s) => ({ ...s, a11y: { ...s.a11y, largeText: !s.a11y.largeText } }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setState((s) => ({ ...s, a11y: { ...s.a11y, highContrast: !s.a11y.highContrast } }));
  }, []);

  const reset = useCallback(() => setState(initial), []);

  const value = useMemo(
    () => ({
      ...state,
      setProfile,
      addXP,
      addCoins,
      loseHeart,
      completeLesson,
      unlockBadge,
      claimDaily,
      toggleLargeText,
      toggleHighContrast,
      reset,
    }),
    [state, setProfile, addXP, addCoins, loseHeart, completeLesson, unlockBadge, claimDaily, toggleLargeText, toggleHighContrast, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}

export { XP_PER_LEVEL };
