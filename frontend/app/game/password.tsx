import React, { useMemo, useState } from "react";
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
import { GameHeader, RewardChip } from "./fraude-real";

type Score = {
  strength: number; // 0-100
  label: string;
  color: string;
  checks: { label: string; ok: boolean }[];
};

function score(pwd: string): Score {
  const checks = [
    { label: "Al menos 12 caracteres", ok: pwd.length >= 12 },
    { label: "Mayúsculas y minúsculas", ok: /[a-z]/.test(pwd) && /[A-Z]/.test(pwd) },
    { label: "Al menos un número", ok: /\d/.test(pwd) },
    { label: "Al menos un símbolo (!@#…)", ok: /[^A-Za-z0-9]/.test(pwd) },
    { label: "No es una palabra común", ok: pwd.length > 0 && !/^(password|123456|contraseña|qwerty|admin)/i.test(pwd) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const strength = (passed / checks.length) * 100;
  let label = "Muy débil", color = colors.danger;
  if (strength >= 80) { label = "Muy fuerte"; color = colors.success; }
  else if (strength >= 60) { label = "Fuerte"; color = "#84cc16"; }
  else if (strength >= 40) { label = "Media"; color = colors.warning; }
  else if (strength >= 20) { label = "Débil"; color = "#f97316"; }
  return { strength, label, color, checks };
}

export default function PasswordGame() {
  const router = useRouter();
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [pwd, setPwd] = useState("");
  const s = useMemo(() => score(pwd), [pwd]);

  const finish = () => {
    if (s.strength >= 80) {
      app.addXP(20);
      app.addCoins(10);
      app.unlockBadge("guardian");
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <GameHeader title="Reto de Contraseña" onClose={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Crea la contraseña más fuerte</Text>
          <Text style={styles.subtitle}>
            Escribe una contraseña y observa cómo sube el medidor. ¡Alcanza 100% para ganar la insignia!
          </Text>

          <TextInput
            value={pwd}
            onChangeText={setPwd}
            placeholder="Ej: G4t0!Az*L_2029"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="password-input"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.meterWrap}>
            <View style={styles.meterBg}>
              <View style={[styles.meterFill, { width: `${s.strength}%`, backgroundColor: s.color }]} />
            </View>
            <Text style={[styles.meterLabel, { color: s.color }]}>{s.label}</Text>
          </View>

          <View style={styles.checkList}>
            {s.checks.map((c) => (
              <View key={c.label} style={styles.checkRow}>
                <Ionicons
                  name={c.ok ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={c.ok ? colors.success : colors.textMuted}
                />
                <Text style={[styles.checkText, c.ok && { color: colors.textPrimary, fontWeight: "700" }]}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>

          {s.strength >= 80 && (
            <View style={styles.successCard}>
              <Ionicons name="trophy" size={26} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>¡Contraseña fortísima!</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: 6 }}>
                  <RewardChip icon="star" text="+20 XP" />
                  <RewardChip icon="cash" text="+10 monedas" />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, s.strength < 80 && { opacity: 0.5 }]}
            onPress={finish}
            disabled={s.strength < 80}
            testID="password-finish"
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Reclamar recompensa</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  body: { padding: spacing.lg, paddingBottom: 120 },
  title: { fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  input: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: "700",
    ...shadow.card,
  },
  meterWrap: { marginTop: spacing.lg },
  meterBg: { height: 14, backgroundColor: colors.surfaceElev, borderRadius: 7, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 7 },
  meterLabel: { textAlign: "right", marginTop: 6, fontWeight: "800", fontSize: fontSize.sm },
  checkList: { marginTop: spacing.lg, gap: spacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  checkText: { fontSize: fontSize.base, color: colors.textSecondary },
  successCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  successTitle: { fontWeight: "800", color: colors.success, fontSize: fontSize.base },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    padding: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
});
