import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { AuthField, PrimaryButton, AuthHeader } from "@/src/components/AuthUI";
import { AuthRole } from "@/src/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES: { key: AuthRole; label: string; emoji: string; description: string }[] = [
  { key: "student", label: "Niño/a", emoji: "🧒", description: "Primaria" },
  { key: "teenager", label: "Adolescente", emoji: "🧑‍🎓", description: "Secundaria/prepa" },
  { key: "parent", label: "Padre / Madre", emoji: "👨‍👩‍👧", description: "Familia" },
  { key: "teacher", label: "Docente", emoji: "👩‍🏫", description: "Escuela" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<AuthRole>("student");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string; email?: string; password?: string; confirm?: string; general?: string;
  }>({});

  const strength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0-4
  }, [password]);

  const strengthLabel = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Excelente"][strength];
  const strengthColor = [colors.danger, colors.warning, colors.warning, colors.success, colors.success][strength];

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Escribe tu nombre";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Ingresa un correo válido";
    if (password.length < 8) errs.password = "Mínimo 8 caracteres";
    if (confirm !== password) errs.confirm = "Las contraseñas no coinciden";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const user = await signUpWithEmail(name, email, password, role);
      // No email verification, land directly in join-school or dashboard
      if (!user.school_code) {
        router.replace("/join-school");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      if (e?.status === 409) {
        setErrors({ email: "Ya existe una cuenta con este correo" });
      } else if (e?.status === 422 && e?.body?.detail) {
        const detail = e.body.detail;
        if (Array.isArray(detail)) {
          const field = detail[0]?.loc?.[1];
          const msg = detail[0]?.msg || "Datos inválidos";
          setErrors({ [field]: msg });
        } else {
          setErrors({ general: String(detail) });
        }
      } else {
        setErrors({ general: e?.message || "No se pudo crear la cuenta" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="back-button">
            <Ionicons name="chevron-back" size={26} color={colors.brand} />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>

          <AuthHeader
            emoji="🎮"
            title="Únete a Hack-Seguro"
            subtitle="Aprende, juega y protégete en línea con Hack-Bot."
          />

          <Text style={styles.sectionTitle}>¿Quién usará la cuenta?</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => {
              const selected = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleCard, selected && styles.roleCardSelected]}
                  onPress={() => setRole(r.key)}
                  testID={`role-${r.key}`}
                  activeOpacity={0.85}
                >
                  <Text style={styles.roleEmoji}>{r.emoji}</Text>
                  <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{r.label}</Text>
                  <Text style={[styles.roleDesc, selected && styles.roleDescSelected]}>{r.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: spacing.md }} />

          <AuthField
            label="Nombre"
            icon="person"
            placeholder="Cómo debemos llamarte"
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors({ ...errors, name: undefined }); }}
            autoCapitalize="words"
            error={errors.name}
            testID="reg-name"
            maxLength={60}
          />
          <View style={{ height: spacing.md }} />
          <AuthField
            label="Correo electrónico"
            icon="mail"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChangeText={(v) => { setEmail(v); if (errors.email) setErrors({ ...errors, email: undefined }); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={errors.email}
            testID="reg-email"
          />
          <View style={{ height: spacing.md }} />
          <AuthField
            label="Contraseña"
            icon="lock-closed"
            placeholder="Al menos 8 caracteres"
            value={password}
            onChangeText={(v) => { setPassword(v); if (errors.password) setErrors({ ...errors, password: undefined }); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete="new-password"
            error={errors.password}
            testID="reg-password"
            rightAdornment={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />
          {password.length > 0 ? (
            <View style={styles.strengthRow}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    { backgroundColor: i < strength ? strengthColor : colors.border },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
            </View>
          ) : null}
          <View style={{ height: spacing.md }} />
          <AuthField
            label="Confirmar contraseña"
            icon="checkmark-circle"
            placeholder="Repite tu contraseña"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); if (errors.confirm) setErrors({ ...errors, confirm: undefined }); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            error={errors.confirm}
            testID="reg-confirm"
          />

          {errors.general ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Crear cuenta"
            icon="rocket"
            onPress={submit}
            loading={loading}
            testID="reg-submit"
            style={{ marginTop: spacing.xl }}
          />

          <Text style={styles.legal}>
            Al crear tu cuenta aceptas usar Hack-Seguro de forma responsable.{"\n"}
            Nunca compartas tu contraseña con nadie.
          </Text>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Ya tienes cuenta?</Text>
            <TouchableOpacity onPress={() => router.replace("/auth/login")} testID="go-login">
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: spacing.md,
  },
  backText: { color: colors.brand, fontSize: fontSize.md, fontWeight: "700" },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleCard: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    minHeight: 96,
  },
  roleCardSelected: {
    borderColor: colors.brand,
    backgroundColor: "#EEF3FB",
  },
  roleEmoji: { fontSize: 30, marginBottom: 4 },
  roleLabel: { color: colors.textPrimary, fontWeight: "800", fontSize: fontSize.base },
  roleLabelSelected: { color: colors.brand },
  roleDesc: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  roleDescSelected: { color: colors.brandLight },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 4,
  },
  strengthBar: { height: 6, flex: 1, borderRadius: 4 },
  strengthLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    marginLeft: 6,
    minWidth: 66,
    textAlign: "right",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorBannerText: { color: colors.danger, flex: 1, fontWeight: "600", fontSize: fontSize.sm },
  legal: {
    marginTop: spacing.md,
    color: colors.textMuted,
    textAlign: "center",
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  footerRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: { color: colors.textSecondary, fontSize: fontSize.base },
  footerLink: { color: colors.brand, fontWeight: "800", fontSize: fontSize.base, textDecorationLine: "underline" },
});
