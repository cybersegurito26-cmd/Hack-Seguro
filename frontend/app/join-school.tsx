import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useApp } from "@/src/store";
import { useAuth } from "@/src/auth";

const ROLES = [
  { id: "student", label: "Estudiante", icon: "school" as const },
  { id: "teacher", label: "Docente", icon: "briefcase" as const },
  { id: "parent", label: "Padre / Madre", icon: "people" as const },
];

const GRADES = ["1°", "2°", "3°", "4°", "5°", "6°", "1° Sec", "2° Sec", "3° Sec"];
const GROUPS = ["A", "B", "C", "D"];

export default function JoinSchoolScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { joinSchool } = useApp();

  const [code, setCode] = useState("DEMO-001");
  const [role, setRole] = useState<"student" | "teacher" | "parent">("student");
  const [grade, setGrade] = useState<string | null>("6°");
  const [group, setGroup] = useState<string | null>("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      await joinSchool(
        code.trim().toUpperCase(),
        role === "student" ? grade || undefined : undefined,
        role === "student" ? group || undefined : undefined,
        role,
      );
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "No se pudo unir. Verifica el código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Únete a tu escuela</Text>
          <Text style={styles.subtitle}>Hola {user?.name || "explorador"} 👋</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="early-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Código de escuela</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Ej. DEMO-001"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            testID="school-code-input"
          />
          <Text style={styles.hint}>
            Pide el código a tu maestro. Ejemplos activos: DEMO-001, COL-LEON-001, SEC-CDMX-042, PRIM-GDL-101.
          </Text>

          <Text style={styles.label}>Soy</Text>
          <View style={styles.rolesRow}>
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setRole(r.id as any)}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  testID={`role-${r.id}`}
                  activeOpacity={0.85}
                >
                  <Ionicons name={r.icon} size={22} color={active ? colors.onBrand : colors.brand} />
                  <Text style={[styles.roleText, active && { color: colors.onBrand }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {role === "student" && (
            <>
              <Text style={styles.label}>Grado</Text>
              <View style={styles.pillRow}>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGrade(g)}
                    style={[styles.pill, grade === g && styles.pillActive]}
                    testID={`grade-${g}`}
                  >
                    <Text style={[styles.pillText, grade === g && { color: colors.onBrand }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Grupo</Text>
              <View style={styles.pillRow}>
                {GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGroup(g)}
                    style={[styles.pill, group === g && styles.pillActive]}
                    testID={`group-${g}`}
                  >
                    <Text style={[styles.pillText, group === g && { color: colors.onBrand }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorCard} testID="join-error">
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity
            style={[styles.primary, (!code || loading) && { opacity: 0.5 }]}
            onPress={onJoin}
            disabled={!code || loading}
            testID="join-school-button"
            activeOpacity={0.9}
          >
            <Text style={styles.primaryText}>
              {loading ? "Uniéndote…" : "Entrar a mi escuela"}
            </Text>
            <Ionicons name="rocket" size={22} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: { padding: spacing.sm, borderRadius: 20, backgroundColor: colors.dangerBg },
  body: { padding: spacing.lg, paddingBottom: 120 },
  label: { fontSize: fontSize.base, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: "800",
    ...shadow.card,
  },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  rolesRow: { flexDirection: "row", gap: spacing.sm },
  roleCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 6,
  },
  roleCardActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  roleText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.textPrimary },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.textPrimary },
  errorCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  errorText: { flex: 1, color: colors.danger, fontWeight: "700", fontSize: fontSize.sm },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  primary: {
    backgroundColor: colors.brand,
    padding: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryText: { color: colors.onBrand, fontSize: fontSize.md, fontWeight: "800" },
});
