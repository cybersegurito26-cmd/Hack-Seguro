import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { MEMORY_PAIRS } from "@/src/mock";
import { useApp } from "@/src/store";
import { GameHeader, RewardChip } from "./fraude-real";

type Tile = { id: string; pairId: string; label: string; type: "concept" | "match" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoramaGame() {
  const router = useRouter();
  const app = useApp();

  const tiles = useMemo<Tile[]>(() => {
    const pairs = MEMORY_PAIRS.slice(0, 6);
    const all: Tile[] = pairs.flatMap((p) => [
      { id: `${p.id}-a`, pairId: p.id, label: p.concept, type: "concept" as const },
      { id: `${p.id}-b`, pairId: p.id, label: p.match, type: "match" as const },
    ]);
    return shuffle(all);
  }, []);

  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);

  const done = matched.size === tiles.length;

  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      const ta = tiles.find((t) => t.id === a);
      const tb = tiles.find((t) => t.id === b);
      setMoves((m) => m + 1);
      if (ta && tb && ta.pairId === tb.pairId) {
        setMatched((prev) => new Set(prev).add(a).add(b));
        setFlipped([]);
      } else {
        const t = setTimeout(() => setFlipped([]), 800);
        return () => clearTimeout(t);
      }
    }
  }, [flipped, tiles]);

  const flip = (id: string) => {
    if (flipped.includes(id) || matched.has(id) || flipped.length >= 2) return;
    setFlipped((f) => [...f, id]);
  };

  const finish = () => {
    app.addXP(25);
    app.addCoins(10);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <GameHeader title="Memorama Ciber" onClose={() => router.back()} score={matched.size / 2} total={tiles.length / 2} />
      {done ? (
        <View style={styles.doneScreen}>
          <Ionicons name="trophy" size={90} color={colors.warning} />
          <Text style={styles.doneTitle}>¡Todas las parejas!</Text>
          <Text style={styles.doneSub}>Movimientos: {moves}</Text>
          <View style={styles.rewards}>
            <RewardChip icon="star" text="+25 XP" />
            <RewardChip icon="cash" text="+10 monedas" />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={finish} testID="memorama-finish">
            <Text style={styles.primaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {tiles.map((t) => {
            const isOpen = flipped.includes(t.id) || matched.has(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tile,
                  isOpen && { backgroundColor: t.type === "concept" ? colors.brand : colors.accent },
                  matched.has(t.id) && { opacity: 0.6 },
                ]}
                onPress={() => flip(t.id)}
                activeOpacity={0.85}
                testID={`memorama-tile-${t.id}`}
              >
                {isOpen ? (
                  <Text style={[styles.tileText, t.type === "concept" && { color: colors.onBrand }]}>{t.label}</Text>
                ) : (
                  <Ionicons name="shield-checkmark" size={30} color={colors.brand} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  grid: {
    flex: 1,
    padding: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  tile: {
    width: "30%",
    aspectRatio: 0.85,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  tileText: {
    fontSize: fontSize.sm,
    fontWeight: "800",
    color: colors.brand,
    textAlign: "center",
  },
  doneScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  doneTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.md },
  doneSub: { fontSize: fontSize.md, color: colors.textSecondary },
  rewards: { flexDirection: "row", gap: spacing.md, marginVertical: spacing.md },
  primaryBtn: {
    backgroundColor: colors.brand,
    padding: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
});
