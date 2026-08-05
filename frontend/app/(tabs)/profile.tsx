import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useApp, XP_PER_LEVEL } from "@/src/store";
import { BADGES, MODULES } from "@/src/mock";
import { useAuth } from "@/src/auth";
import { api, BASE_URL } from "@/src/api";

export default function ProfileScreen() {
  const { user } = useApp();
  const { logout } = useAuth();
  const [a11y, setA11y] = useState({ largeText: false, highContrast: false });

  if (!user) return null;

  const xpInLevel = user.xp % XP_PER_LEVEL;
  const xpPercent = Math.min(100, (xpInLevel / XP_PER_LEVEL) * 100);
  const unlockedBadgeIds = new Set(user.badges);
  const badges = BADGES.map((b) => ({ ...b, unlocked: unlockedBadgeIds.has(b.id) }));
  const unlockedBadges = badges.filter((b) => b.unlocked);
  const completedModules = MODULES.filter((m) => (user.completed_lessons?.[m.id] || 0) >= 1);

  const openCertificate = async (moduleId: string) => {
    const { url, token } = await api.certificateUrl(moduleId);
    const withToken = `${url}?t=${encodeURIComponent(token || "")}`;
    try {
      await Linking.openURL(withToken);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard} testID="profile-header">
          <View style={styles.avatarBig}>
            <Ionicons name="shield-checkmark" size={54} color={colors.brand} />
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>Nvl {user.level}</Text>
            </View>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.role}>
            {user.role === "teacher" ? "Docente" : user.role === "parent" ? "Padre / Madre" : "Estudiante"}
            {user.school_code ? ` · ${user.school_code}` : ""}
            {user.grade && user.group ? ` · ${user.grade} ${user.group}` : ""}
          </Text>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${xpPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{xpInLevel} / {XP_PER_LEVEL} XP · Nivel {user.level + 1}</Text>

          <View style={styles.miniStats}>
            <MiniStat icon="star" color={colors.warning} value={user.xp} label="XP" />
            <MiniStat icon="cash" color={colors.accentDark} value={user.coins} label="Monedas" />
            <MiniStat icon="flame" color={colors.streakFire} value={user.streak} label="Racha" />
            <MiniStat icon="ribbon" color={colors.brand} value={unlockedBadges.length} label="Insignias" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Mis insignias</Text>
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
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

        <Text style={styles.sectionTitle}>Certificados</Text>
        {completedModules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Completa al menos una lección de un módulo para desbloquear tu primer certificado en PDF.
            </Text>
          </View>
        ) : (
          <View style={styles.settingCard}>
            {completedModules.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => openCertificate(m.id)}
                  testID={`certificate-${m.id}`}
                  activeOpacity={0.75}
                >
                  <View style={styles.settingIcon}>
                    <Ionicons name="document" size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{m.title}</Text>
                    <Text style={styles.settingHint}>Descargar PDF firmado</Text>
                  </View>
                  <Ionicons name="download" size={20} color={colors.brand} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Accesibilidad</Text>
        <View style={styles.settingCard}>
          <SettingRow
            icon="text"
            label="Texto grande"
            value={a11y.largeText}
            onToggle={() => setA11y((s) => ({ ...s, largeText: !s.largeText }))}
            testID="toggle-large-text"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="contrast"
            label="Alto contraste"
            value={a11y.highContrast}
            onToggle={() => setA11y((s) => ({ ...s, highContrast: !s.highContrast }))}
            testID="toggle-high-contrast"
          />
        </View>

        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={logout}
          testID="logout-button"
          activeOpacity={0.85}
        >
          <Ionicons name="log-out" size={20} color={colors.danger} />
          <Text style={styles.dangerText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Hack-Seguro · v2.0 · Hecho con ❤️ en México</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerCard: { backgroundColor: colors.surfaceAlt, padding: spacing.lg, borderRadius: radius.lg, alignItems: "center", ...shadow.card },
  avatarBig: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.brand,
  },
  levelChip: {
    position: "absolute", bottom: -6, backgroundColor: colors.brand,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: 2, borderColor: colors.surfaceAlt,
  },
  levelChipText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.xs },
  name: { marginTop: spacing.lg, fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary },
  role: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  progressBar: {
    marginTop: spacing.md, width: "100%", height: 10,
    backgroundColor: colors.surfaceElev, borderRadius: 5, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  progressText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 6 },
  miniStats: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.sm },
  miniStat: {
    flex: 1, alignItems: "center",
    backgroundColor: colors.surfaceElev, paddingVertical: spacing.sm, borderRadius: radius.md,
  },
  miniStatValue: { fontSize: fontSize.base, fontWeight: "800", color: colors.textPrimary, marginTop: 4 },
  miniStatLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary,
    marginTop: spacing.xl, marginBottom: spacing.md,
  },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  badgeCard: { width: "48%", padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, ...shadow.card },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  badgeTitle: { fontSize: fontSize.sm, fontWeight: "800", color: colors.textPrimary },
  badgeDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  emptyCard: {
    padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    flexDirection: "row", gap: spacing.sm, alignItems: "center", ...shadow.card,
  },
  emptyText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
  settingCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, ...shadow.card },
  settingRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  settingIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF3FB",
    alignItems: "center", justifyContent: "center",
  },
  settingLabel: { flex: 1, fontSize: fontSize.base, fontWeight: "600", color: colors.textPrimary },
  settingHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 40 + spacing.md },
  dangerBtn: {
    marginTop: spacing.xl, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.dangerBg, gap: spacing.sm,
  },
  dangerText: { color: colors.danger, fontWeight: "800" },
  footer: { marginTop: spacing.xl, textAlign: "center", color: colors.textMuted, fontSize: fontSize.xs },
});
