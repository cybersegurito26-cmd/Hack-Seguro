import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function TeacherScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.teacherRoster();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel docente</Text>
        <Text style={styles.subtitle}>
          {user?.school_code ? `Escuela ${user.school_code}` : "Sin escuela"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {(!data?.groups?.length) ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={30} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Aún no hay estudiantes registrados en esta escuela. Comparte el código de tu escuela con tus alumnos para verlos aquí.
              </Text>
            </View>
          ) : (
            (data.groups as any[]).map((g) => (
              <View key={g.grade_group} style={styles.groupCard} testID={`group-${g.grade_group}`}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconWrap}>
                    <Ionicons name="school" size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>Grupo {g.grade_group}</Text>
                    <Text style={styles.groupSub}>{g.students.length} estudiante(s)</Text>
                  </View>
                </View>
                {g.students.map((s: any, i: number) => (
                  <View key={s.user_id} style={styles.studentRow} testID={`student-${s.user_id}`}>
                    <View style={styles.rankBox}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={18} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.studentMeta}>
                        Nvl {s.level} · Racha {s.streak} · {Object.keys(s.completed_lessons || {}).length} módulos
                      </Text>
                    </View>
                    <View style={styles.xpChip}>
                      <Text style={styles.xpChipText}>{s.xp} XP</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.brand} />
            <Text style={styles.infoText}>
              Este panel se actualiza en tiempo real. Los certificados de cada estudiante se generan al completar cada módulo.
            </Text>
          </View>
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
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, gap: spacing.md },
  emptyCard: {
    padding: spacing.lg, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, alignItems: "center", gap: spacing.sm, ...shadow.card,
  },
  emptyText: { textAlign: "center", color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  groupCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, ...shadow.card,
  },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  groupIconWrap: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF3FB",
    alignItems: "center", justifyContent: "center",
  },
  groupTitle: { fontWeight: "800", color: colors.textPrimary, fontSize: fontSize.base },
  groupSub: { color: colors.textSecondary, fontSize: fontSize.xs },
  studentRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: colors.border,
  },
  rankBox: { width: 24, alignItems: "center" },
  rankText: { color: colors.textSecondary, fontWeight: "800" },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF3FB",
    alignItems: "center", justifyContent: "center",
  },
  studentName: { fontWeight: "700", color: colors.textPrimary, fontSize: fontSize.sm },
  studentMeta: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  xpChip: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  xpChipText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.xs },
  infoCard: {
    marginTop: spacing.md, flexDirection: "row", gap: spacing.sm,
    padding: spacing.md, backgroundColor: "#EEF3FB", borderRadius: radius.md,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, color: colors.brand, fontSize: fontSize.sm, lineHeight: 20 },
});
