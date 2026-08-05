import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { GAMES } from "@/src/mock";

export default function GamesScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Juegos</Text>
        <Text style={styles.subtitle}>Aprende jugando y gana XP</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {GAMES.map((g) => (
            <TouchableOpacity
              key={g.id}
              activeOpacity={0.9}
              style={[styles.card, { backgroundColor: g.color }]}
              onPress={() => router.push(g.route as any)}
              testID={`game-card-${g.id}`}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={g.icon as any} size={38} color={colors.onBrand} />
              </View>
              <Text style={styles.cardTitle}>{g.title}</Text>
              <Text style={styles.cardSub}>{g.subtitle}</Text>
              <View style={styles.rewardRow}>
                <View style={styles.xpChip}>
                  <Ionicons name="star" size={12} color={colors.brand} />
                  <Text style={styles.xpChipText}>+{g.xp} XP</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  scroll: { padding: spacing.lg },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    aspectRatio: 0.85,
    padding: spacing.md,
    borderRadius: radius.lg,
    justifyContent: "space-between",
    ...shadow.card,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: colors.onBrand,
    fontSize: fontSize.md,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  cardSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  rewardRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
  },
  xpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  xpChipText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.xs },
});
