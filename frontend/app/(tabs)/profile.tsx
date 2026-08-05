import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useApp, XP_PER_LEVEL } from "@/src/store";
import { PROFILES } from "@/src/mock";

export default function ProfileScreen() {
  const app = useApp();
  const xpInLevel = app.xp % XP_PER_LEVEL;
  const xpPercent = Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100);
  const profileMeta = PROFILES.find((p) => p.id === app.profile) || PROFILES[0];

  const unlockedBadges = app.badges.filter((b) => b.unlocked);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar Header */}
        <View style={styles.headerCard} testID="profile-header">
          <View style={styles.avatarBig}>
            <Ionicons name={app.avatar as any} size={54} color={colors.brand} />
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>Nvl {app.level}</Text>
            </View>
          </View>
          <Text style={styles.name}>{app.name}</Text>
          <Text style={styles.role}>{profileMeta.label}</Text>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${xpPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {xpInLevel} / {XP_PER_LEVEL} XP · Nivel {app.level + 1}
          </Text>

          <View style={styles.miniStats}>
            <MiniStat icon="star" color={colors.warning} value={app.xp} label="XP" />
            <MiniStat icon="cash" color={colors.accentDark} value={app.coins} label="Monedas" />
            <MiniStat icon="flame" color={colors.streakFire} value={app.streak} label="Racha" />
            <MiniStat icon="ribbon" color={colors.brand} value={unlockedBadges.length} label="Insignias" />
          </View>
        </View>

        {/* Badges */}
        <Text style={styles.sectionTitle}>Mis insignias</Text>
        <View style={styles.badgesGrid}>
          {app.badges.map((b) => (
            <View
              key={b.id}
              style={[styles.badgeCard, !b.unlocked && styles.badgeLocked]}
              testID={`profile-badge-${b.id}`}
            >
              <View style={[styles.badgeIcon, { backgroundColor: b.color + (b.unlocked ? "22" : "11") }]}>
                <Ionicons
                  name={(b.unlocked ? b.icon : "lock-closed") as any}
                  size={22}
                  color={b.unlocked ? b.color : colors.textMuted}
                />
              </View>
              <Text style={styles.badgeTitle} numberOfLines={2}>{b.name}</Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
            </View>
          ))}
        </View>

        {/* Accessibility */}
        <Text style={styles.sectionTitle}>Accesibilidad</Text>
        <View style={styles.settingCard}>
          <SettingRow
            icon="text"
            label="Texto grande"
            value={app.a11y.largeText}
            onToggle={app.toggleLargeText}
            testID="toggle-large-text"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="contrast"
            label="Alto contraste"
            value={app.a11y.highContrast}
            onToggle={app.toggleHighContrast}
            testID="toggle-high-contrast"
          />
        </View>

        {/* Family / School section */}
        <Text style={styles.sectionTitle}>Familia y Escuela</Text>
        <View style={styles.settingCard}>
          <LinkRow icon="school" label="Panel para docentes" hint="Próximamente" testID="row-teacher" />
          <View style={styles.divider} />
          <LinkRow icon="people" label="Progreso de tus hijos" hint="Próximamente" testID="row-parents" />
          <View style={styles.divider} />
          <LinkRow icon="document" label="Certificado de participación" hint="Se genera al terminar módulos" testID="row-cert" />
        </View>

        {/* Change profile */}
        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={() => {
            app.reset();
          }}
          testID="reset-button"
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={20} color={colors.danger} />
          <Text style={styles.dangerText}>Cambiar de perfil</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Hack-Seguro · v1.0 · Hecho con ❤️ en México</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ icon, color, value, label }: { icon: any; color: string; value: number; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ icon, label, value, onToggle, testID }: { icon: any; label: string; value: boolean; onToggle: () => void; testID?: string }) {
  return (
    <View style={styles.settingRow} testID={testID}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.borderStrong, true: colors.brand }}
        thumbColor={colors.onBrand}
      />
    </View>
  );
}

function LinkRow({ icon, label, hint, testID }: { icon: any; label: string; hint: string; testID?: string }) {
  return (
    <TouchableOpacity style={styles.settingRow} testID={testID} activeOpacity={0.7}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerCard: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.card,
  },
  avatarBig: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.brand,
  },
  levelChip: {
    position: "absolute",
    bottom: -6,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surfaceAlt,
  },
  levelChipText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.xs },
  name: { marginTop: spacing.lg, fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  progressBar: {
    marginTop: spacing.md,
    width: "100%",
    height: 10,
    backgroundColor: colors.surfaceElev,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  progressText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 6 },
  miniStats: {
    flexDirection: "row",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceElev,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  miniStatValue: { fontSize: fontSize.base, fontWeight: "800", color: colors.textPrimary, marginTop: 4 },
  miniStatLabel: { fontSize: fontSize.xs, color: colors.textSecondary },

  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  badgeCard: {
    width: "48%",
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...shadow.card,
  },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  badgeTitle: { fontSize: fontSize.sm, fontWeight: "800", color: colors.textPrimary },
  badgeDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  settingCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...shadow.card,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: fontSize.base, fontWeight: "600", color: colors.textPrimary },
  settingHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 40 + spacing.md },

  dangerBtn: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    gap: spacing.sm,
  },
  dangerText: { color: colors.danger, fontWeight: "800" },
  footer: {
    marginTop: spacing.xl,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
});
