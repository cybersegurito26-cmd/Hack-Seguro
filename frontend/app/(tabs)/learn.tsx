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
import { MODULES } from "@/src/mock";
import { useApp } from "@/src/store";

export default function LearnScreen() {
  const router = useRouter();
  const app = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Aprende</Text>
        <Text style={styles.subtitle}>Tu ruta de ciberseguridad</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {MODULES.map((m, index) => {
          const completed = app.completedLessons[m.id] || 0;
          const total = m.lessons.length;
          const progress = total > 0 ? completed / total : 0;
          const isDone = completed >= total;
          // First module is unlocked. Each next unlocks when previous has at least 1 completed lesson.
          const prevId = MODULES[index - 1]?.id;
          const isUnlocked = index === 0 || (prevId && (app.completedLessons[prevId] || 0) >= 1);
          const align = index % 2 === 0 ? "flex-start" : "flex-end";

          return (
            <View key={m.id} style={styles.nodeRow}>
              {index > 0 && <View style={[styles.connector, { alignSelf: index % 2 === 0 ? "flex-end" : "flex-start" }]} />}
              <View style={{ alignSelf: align as any, width: "78%" }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!isUnlocked}
                  onPress={() => router.push(`/lesson/${m.id}` as any)}
                  style={[
                    styles.node,
                    { backgroundColor: isUnlocked ? m.color : colors.surfaceElev },
                    isDone && { borderColor: colors.accent, borderWidth: 3 },
                  ]}
                  testID={`module-node-${m.id}`}
                >
                  <View style={styles.nodeIconWrap}>
                    <Ionicons
                      name={isUnlocked ? (m.icon as any) : "lock-closed"}
                      size={30}
                      color={isUnlocked ? colors.onBrand : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.nodeTitle, !isUnlocked && { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {m.title}
                    </Text>
                    <Text
                      style={[styles.nodeSub, !isUnlocked && { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {m.subtitle}
                    </Text>
                    <View style={styles.progressWrap}>
                      <View style={styles.progressBg}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressLabel}>
                        {completed}/{total}
                      </Text>
                    </View>
                  </View>
                  {isDone && (
                    <View style={styles.starBadge}>
                      <Ionicons name="star" size={14} color={colors.brand} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
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
    backgroundColor: colors.surface,
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  scroll: { padding: spacing.lg, gap: spacing.md },
  nodeRow: { minHeight: 100 },
  connector: {
    position: "absolute",
    top: -12,
    width: 3,
    height: 24,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginHorizontal: spacing.xl,
  },
  node: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    gap: spacing.md,
    ...shadow.card,
  },
  nodeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.onBrand },
  nodeSub: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 8 },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  progressLabel: { color: colors.onBrand, fontSize: fontSize.xs, fontWeight: "700" },
  starBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
