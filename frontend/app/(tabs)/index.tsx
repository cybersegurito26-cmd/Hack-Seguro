import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useApp, XP_PER_LEVEL } from "@/src/store";
import { MODULES, DAILY_CHALLENGES } from "@/src/mock";

export default function Dashboard() {
  const router = useRouter();
  const app = useApp();

  const xpInLevel = app.xp % XP_PER_LEVEL;
  const xpPercent = Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100);

  const recommended = MODULES.find((m) => (app.completedLessons[m.id] || 0) < m.lessons.length) || MODULES[0];
  const totalUnlockedBadges = app.badges.filter((b) => b.unlocked).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Sticky top header */}
      <View style={styles.stickyHeader} testID="dashboard-header">
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.hello}>¡Hola, {app.name}! 👋</Text>
            <Text style={styles.subhello}>Sigue aprendiendo hoy</Text>
          </View>
          <View style={styles.streakChip} testID="streak-chip">
            <Ionicons name="flame" size={18} color={colors.streakFire} />
            <Text style={styles.streakText}>{app.streak}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatPill icon="star" iconColor={colors.warning} value={app.xp} label="XP" testID="stat-xp" />
          <StatPill icon="cash" iconColor={colors.accentDark} value={app.coins} label="Monedas" testID="stat-coins" />
          <StatPill icon="heart" iconColor={colors.danger} value={app.hearts} label="Vidas" testID="stat-hearts" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Level card */}
        <View style={styles.levelCard} testID="level-card">
          <View style={styles.levelBadge}>
            <Text style={styles.levelNum}>{app.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.levelLabel}>Nivel {app.level} · Aprendiz Ciber</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${xpPercent}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {xpInLevel} / {XP_PER_LEVEL} XP para el nivel {app.level + 1}
            </Text>
          </View>
        </View>

        {/* Daily reward */}
        <Pressable
          style={({ pressed }) => [
            styles.dailyChest,
            { transform: [{ scale: pressed ? 0.98 : 1 }] },
            app.dailyClaimed && { opacity: 0.7 },
          ]}
          onPress={() => !app.dailyClaimed && app.claimDaily()}
          disabled={app.dailyClaimed}
          testID="daily-chest"
        >
          <View style={styles.chestIcon}>
            <Ionicons name={app.dailyClaimed ? "checkmark-circle" : "gift"} size={30} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chestTitle}>
              {app.dailyClaimed ? "¡Reclamado hoy!" : "Cofre diario"}
            </Text>
            <Text style={styles.chestSub}>
              {app.dailyClaimed ? "Vuelve mañana para más" : "+15 monedas y +20 XP"}
            </Text>
          </View>
          {!app.dailyClaimed && (
            <View style={styles.chestCta}>
              <Text style={styles.chestCtaText}>Abrir</Text>
            </View>
          )}
        </Pressable>

        {/* Recommended lesson */}
        <Text style={styles.sectionTitle}>Lección recomendada</Text>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.recCard, { backgroundColor: recommended.color }]}
          onPress={() => router.push(`/lesson/${recommended.id}` as any)}
          testID="recommended-lesson"
        >
          <View style={styles.recIconWrap}>
            <Ionicons name={recommended.icon as any} size={40} color={colors.onBrand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recModule}>Módulo del día</Text>
            <Text style={styles.recTitle}>{recommended.title}</Text>
            <Text style={styles.recSub}>{recommended.subtitle}</Text>
          </View>
          <View style={styles.playBtn}>
            <Ionicons name="play" size={22} color={recommended.color} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bigPlayBtn}
          onPress={() => router.push("/(tabs)/games" as any)}
          testID="play-now-button"
          activeOpacity={0.9}
        >
          <Ionicons name="game-controller" size={22} color={colors.brand} />
          <Text style={styles.bigPlayText}>Jugar ahora</Text>
        </TouchableOpacity>

        {/* Daily challenges */}
        <Text style={styles.sectionTitle}>Retos de hoy</Text>
        <View style={styles.challengeList}>
          {DAILY_CHALLENGES.map((c) => (
            <View key={c.id} style={styles.challengeCard} testID={`challenge-${c.id}`}>
              <View style={styles.challengeIcon}>
                <Ionicons name={c.icon as any} size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.challengeTitle}>{c.title}</Text>
                <Text style={styles.challengeDesc}>{c.desc}</Text>
              </View>
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>+{c.xp} XP</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Badges preview */}
        <View style={styles.badgesHeader}>
          <Text style={styles.sectionTitle}>Insignias</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)} testID="see-all-badges">
            <Text style={styles.linkText}>Ver todas ({totalUnlockedBadges}/{app.badges.length})</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgeRow}
        >
          {app.badges.map((b) => (
            <View
              key={b.id}
              style={[styles.badge, !b.unlocked && styles.badgeLocked]}
              testID={`badge-${b.id}`}
            >
              <View style={[styles.badgeIcon, { backgroundColor: b.color + (b.unlocked ? "22" : "11") }]}>
                <Ionicons name={b.icon as any} size={26} color={b.unlocked ? b.color : colors.textMuted} />
              </View>
              <Text style={[styles.badgeName, !b.unlocked && { color: colors.textMuted }]} numberOfLines={2}>
                {b.name}
              </Text>
              {!b.unlocked && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({
  icon,
  iconColor,
  value,
  label,
  testID,
}: {
  icon: any;
  iconColor: string;
  value: number;
  label: string;
  testID?: string;
}) {
  return (
    <View style={styles.statPill} testID={testID}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  stickyHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hello: { fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary },
  subhello: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  streakText: { fontWeight: "800", color: colors.streakFire },
  statsRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
    ...shadow.card,
  },
  statValue: { fontSize: fontSize.base, fontWeight: "800", color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginLeft: 2 },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.accent,
  },
  levelNum: { color: colors.onBrand, fontSize: fontSize.lg, fontWeight: "800" },
  levelLabel: { fontSize: fontSize.base, fontWeight: "700", color: colors.textPrimary },
  progressBar: {
    height: 10,
    backgroundColor: colors.surfaceElev,
    borderRadius: 5,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 5,
  },
  progressText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4 },

  dailyChest: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "#EEF3FB",
    borderRadius: radius.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.brand,
    borderStyle: "dashed",
  },
  chestIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  chestTitle: { fontWeight: "800", color: colors.textPrimary, fontSize: fontSize.base },
  chestSub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  chestCta: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chestCtaText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.sm },

  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  recIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  recModule: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  recTitle: { color: colors.onBrand, fontSize: fontSize.md, fontWeight: "800", marginTop: 2 },
  recSub: { color: "rgba(255,255,255,0.9)", fontSize: fontSize.sm, marginTop: 2 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.onBrand,
    alignItems: "center",
    justifyContent: "center",
  },

  bigPlayBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow.card,
  },
  bigPlayText: {
    color: colors.brand,
    fontSize: fontSize.md,
    fontWeight: "800",
  },

  challengeList: { gap: spacing.sm },
  challengeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    gap: spacing.md,
    ...shadow.card,
  },
  challengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.textPrimary },
  challengeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  xpBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  xpBadgeText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.xs },

  badgesHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  linkText: { color: colors.brand, fontWeight: "700", fontSize: fontSize.sm },

  badgeRow: { gap: spacing.md, paddingRight: spacing.lg },
  badge: {
    width: 96,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    alignItems: "center",
    ...shadow.card,
  },
  badgeLocked: { opacity: 0.65 },
  badgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badgeName: {
    fontSize: fontSize.xs,
    textAlign: "center",
    color: colors.textPrimary,
    fontWeight: "700",
  },
  lockOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00000010",
    alignItems: "center",
    justifyContent: "center",
  },
});
