import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Share,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { api } from "@/src/api";

type ReferralData = Awaited<ReturnType<typeof api.referralsMine>>;

export function AmbassadorsCard({ userName }: { userName: string }) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterOpen, setPosterOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.referralsMine();
      setData(r);
    } catch {
      // silently fail — card will show retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const share = async () => {
    if (!data) return;
    const message =
      `🛡️ ¡Hey! Únete a Hack-Seguro conmigo (${userName}) y aprende a protegerte en internet jugando.\n\n` +
      `Al completar tu primera lección, ambos ganamos +50 XP.\n\n${data.share_url}`;
    try {
      if (Platform.OS === "web") {
        // Web Share API
        const nav: any = typeof navigator !== "undefined" ? navigator : {};
        if (nav && typeof nav.share === "function") {
          await nav.share({ title: "Hack-Seguro", text: message, url: data.share_url });
        } else if (nav && nav.clipboard?.writeText) {
          await nav.clipboard.writeText(data.share_url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } else {
        await Share.share({ message, url: data.share_url, title: "Hack-Seguro" });
      }
    } catch {
      // user cancelled — no-op
    }
  };

  const copy = async () => {
    if (!data) return;
    try {
      await Clipboard.setStringAsync(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Estudiantes invitados</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retry}>Toca para reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const validCount = data.valid;
  const pendingCount = data.pending;
  const nextGoal = data.next_goal ?? 10;
  const progressPct = Math.min(100, (validCount / nextGoal) * 100);

  return (
    <>
      <View style={styles.card} testID="ambassadors-card">
        <View style={styles.headerRow}>
          <View style={styles.iconBubble}>
            <Ionicons name="megaphone" size={22} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Estudiantes invitados</Text>
            <Text style={styles.subtitle}>
              Cada amigo que complete una lección suma +1 a tu ranking.
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="referrals-valid">{validCount}</Text>
            <Text style={styles.statLabel}>Confirmados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.warning }]} testID="referrals-pending">{pendingCount}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.accentDark }]}>
              {nextGoal === null ? "—" : Math.max(0, nextGoal - validCount)}
            </Text>
            <Text style={styles.statLabel}>Para insignia</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.goalsRow}>
            <GoalPill label="🥉 3 invitados" unlocked={validCount >= 3} />
            <GoalPill label="🥇 10 invitados" unlocked={validCount >= 10} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={share}
          activeOpacity={0.85}
          testID="invite-share-button"
        >
          <Ionicons name="share-social" size={20} color={colors.brand} />
          <Text style={styles.primaryText}>Invitar a mi escuela</Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={copy} testID="invite-copy-button">
            <Ionicons name={copied ? "checkmark" : "copy"} size={18} color={colors.brand} />
            <Text style={styles.secondaryText}>{copied ? "¡Copiado!" : "Copiar link"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setPosterOpen(true)}
            testID="invite-poster-button"
          >
            <Ionicons name="qr-code" size={18} color={colors.brand} />
            <Text style={styles.secondaryText}>Ver póster</Text>
          </TouchableOpacity>
        </View>

        {data.invitees && data.invitees.length > 0 ? (
          <View style={styles.invitees}>
            <Text style={styles.inviteesTitle}>Tus últimos invitados</Text>
            {data.invitees.slice(0, 5).map((inv, i) => (
              <View key={i} style={styles.inviteeRow}>
                <View style={styles.avatar}>
                  {inv.picture ? (
                    <Image source={{ uri: inv.picture }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{inv.name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.inviteeName}>{inv.name}</Text>
                {inv.status === "valid" ? (
                  <View style={[styles.statusPill, { backgroundColor: colors.successBg }]}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={[styles.statusText, { color: colors.success }]}>Confirmado</Text>
                  </View>
                ) : (
                  <View style={[styles.statusPill, { backgroundColor: colors.warningBg }]}>
                    <Ionicons name="hourglass" size={13} color={colors.warning} />
                    <Text style={[styles.statusText, { color: colors.warning }]}>Pendiente</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Modal
        visible={posterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPosterOpen(false)}
      >
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.sheetHeader}>
              <Text style={modalStyles.sheetTitle}>Tu póster de embajador</Text>
              <TouchableOpacity onPress={() => setPosterOpen(false)} testID="poster-close">
                <Ionicons name="close-circle" size={30} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={modalStyles.sheetBody}>
              <Image
                source={{ uri: api.referralPosterUrl() }}
                style={modalStyles.poster}
                resizeMode="contain"
              />
              <Text style={modalStyles.hint}>
                Comparte esta imagen en el chat de tu grupo o pégala en el pizarrón del salón.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={share} testID="poster-share">
                <Ionicons name="share-social" size={20} color={colors.brand} />
                <Text style={styles.primaryText}>Compartir link</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function GoalPill({ label, unlocked }: { label: string; unlocked: boolean }) {
  return (
    <View style={[styles.goalPill, unlocked && styles.goalPillOn]}>
      <Text style={[styles.goalPillText, unlocked && styles.goalPillTextOn]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  headerRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  iconBubble: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#EEF3FB",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  retry: { color: colors.brand, fontWeight: "700", marginTop: 8 },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: { fontSize: fontSize.xl, fontWeight: "900", color: colors.brand },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, fontWeight: "600" },
  progressWrap: { marginTop: spacing.md },
  progressBar: {
    height: 10,
    backgroundColor: colors.surfaceElev,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  goalsRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  goalPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElev,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  goalPillOn: {
    backgroundColor: "#FFFBEA",
    borderColor: colors.accent,
  },
  goalPillText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: "700" },
  goalPillTextOn: { color: colors.brand },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    ...shadow.card,
  },
  primaryText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.md },
  secondaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  secondaryBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  secondaryText: { color: colors.brand, fontWeight: "700", fontSize: fontSize.sm },
  invitees: { marginTop: spacing.lg },
  inviteesTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  inviteeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 32, height: 32 },
  avatarInitial: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.sm },
  inviteeName: { flex: 1, color: colors.textPrimary, fontWeight: "600", fontSize: fontSize.sm },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary },
  sheetBody: { padding: spacing.lg, gap: spacing.md },
  poster: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElev,
  },
  hint: { color: colors.textSecondary, textAlign: "center", fontSize: fontSize.sm, lineHeight: 20 },
});
