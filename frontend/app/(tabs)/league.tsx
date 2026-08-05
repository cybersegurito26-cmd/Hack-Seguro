import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Row = {
  rank: number;
  user_id: string;
  name?: string;
  picture?: string | null;
  grade?: string | null;
  group?: string | null;
  xp: number;
};

function medal(rank: number): { icon: string; color: string } | null {
  if (rank === 1) return { icon: "medal", color: "#EAB308" };
  if (rank === 2) return { icon: "medal", color: "#9CA3AF" };
  if (rank === 3) return { icon: "medal", color: "#B45309" };
  return null;
}

function weekLabel(iso: string): string {
  const d = new Date(iso);
  const end = new Date(d.getTime() + 6 * 86400000);
  const fmt = (x: Date) => `${x.getDate().toString().padStart(2, "0")}/${(x.getMonth() + 1).toString().padStart(2, "0")}`;
  return `Semana ${fmt(d)} – ${fmt(end)}`;
}

export default function LeagueScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"school" | "global">("school");
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.weeklyLeaderboard(scope);
      setData(res);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Liga semanal</Text>
          <Text style={styles.subtitle}>
            {user?.school_code ? `Escuela ${user.school_code}` : "Sin escuela"}
            {data?.week_start ? ` · ${weekLabel(data.week_start)}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.scopeRow} testID="league-scope-row">
        <TouchableOpacity
          style={[styles.scopeBtn, scope === "school" && styles.scopeBtnActive]}
          onPress={() => setScope("school")}
          testID="scope-school"
        >
          <Ionicons name="school" size={16} color={scope === "school" ? colors.onBrand : colors.brand} />
          <Text style={[styles.scopeText, scope === "school" && { color: colors.onBrand }]}>
            Mi escuela
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeBtn, scope === "global" && styles.scopeBtnActive]}
          onPress={() => setScope("global")}
          testID="scope-global"
        >
          <Ionicons name="globe" size={16} color={scope === "global" ? colors.onBrand : colors.brand} />
          <Text style={[styles.scopeText, scope === "global" && { color: colors.onBrand }]}>
            Nacional
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {data?.me && (
            <View style={styles.meCard} testID="league-me-card">
              <View style={styles.meRank}>
                <Text style={styles.meRankText}>#{data.me.rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meTitle}>Tú, esta semana</Text>
                <Text style={styles.meSub}>{data.me.xp} XP acumulados</Text>
              </View>
              <Ionicons name="flame" size={22} color={colors.streakFire} />
            </View>
          )}

          <Text style={styles.sectionTitle}>Top 10</Text>
          {data?.top?.length ? (
            data.top.map((row: Row) => {
              const m = medal(row.rank);
              const isMe = user && row.user_id === user.user_id;
              return (
                <View
                  key={row.user_id}
                  style={[styles.row, isMe && styles.rowMe]}
                  testID={`league-row-${row.rank}`}
                >
                  <View style={styles.rankBox}>
                    {m ? (
                      <Ionicons name={m.icon as any} size={24} color={m.color} />
                    ) : (
                      <Text style={styles.rankText}>{row.rank}</Text>
                    )}
                  </View>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{row.name || "Explorador"}</Text>
                    {(row.grade || row.group) && (
                      <Text style={styles.rowMeta}>{[row.grade, row.group].filter(Boolean).join(" · ")}</Text>
                    )}
                  </View>
                  <View style={styles.xpChip}>
                    <Text style={styles.xpChipText}>{row.xp} XP</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Aún no hay puntuaciones esta semana. Completa lecciones y juegos para aparecer aquí.
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.brand} />
            <Text style={styles.infoText}>
              La liga se reinicia cada lunes. Compite con estudiantes de tu escuela y desbloquea insignias por escalar posiciones.
            </Text>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  scopeRow: {
    flexDirection: "row", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  scopeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#EEF3FB",
    borderWidth: 1, borderColor: colors.brand + "33",
  },
  scopeBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  scopeText: { color: colors.brand, fontWeight: "700", fontSize: fontSize.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, gap: spacing.md },
  meCard: {
    flexDirection: "row", alignItems: "center",
    padding: spacing.md, gap: spacing.md,
    backgroundColor: colors.accent, borderRadius: radius.lg, ...shadow.card,
  },
  meRank: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  meRankText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
  meTitle: { fontWeight: "800", color: colors.brand, fontSize: fontSize.base },
  meSub: { color: colors.brand, opacity: 0.75, fontSize: fontSize.sm, marginTop: 2 },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    padding: spacing.md, gap: spacing.md,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    ...shadow.card,
  },
  rowMe: { borderWidth: 2, borderColor: colors.accent },
  rankBox: {
    width: 34, alignItems: "center", justifyContent: "center",
  },
  rankText: { color: colors.textPrimary, fontWeight: "800", fontSize: fontSize.md },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF3FB",
    alignItems: "center", justifyContent: "center",
  },
  rowName: { fontWeight: "700", color: colors.textPrimary, fontSize: fontSize.base },
  rowMeta: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  xpChip: {
    backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  xpChipText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.xs },
  emptyCard: {
    padding: spacing.lg, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, alignItems: "center", gap: spacing.sm, ...shadow.card,
  },
  emptyText: { textAlign: "center", color: colors.textSecondary, fontSize: fontSize.sm },
  infoCard: {
    marginTop: spacing.md, flexDirection: "row", gap: spacing.sm,
    padding: spacing.md, backgroundColor: "#EEF3FB", borderRadius: radius.md,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, color: colors.brand, fontSize: fontSize.sm, lineHeight: 20 },
});
