import React, { useState } from "react";
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

import { colors, spacing, fontSize } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { AuthField, PrimaryButton, AuthHeader } from "@/src/components/AuthUI";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const submit = async () => {
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = "Ingresa un correo válido";
    if (password.length < 1) errs.password = "Ingresa tu contraseña";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const user = await signInWithEmail(email, password);
      if (!user.school_code) {
        router.replace("/join-school");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      const msg = e?.message || "No se pudo iniciar sesión";
      if (e?.status === 401) {
        setErrors({ general: "Correo o contraseña incorrectos" });
      } else {
        setErrors({ general: msg });
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
            emoji="🛡️"
            title="Bienvenido de vuelta"
            subtitle="Hack-Bot te acompañará a proteger tu vida digital."
          />

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
            testID="login-email"
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
            autoComplete="password"
            error={errors.password}
            testID="login-password"
            rightAdornment={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.forgot}
            onPress={() => router.push({ pathname: "/auth/forgot", params: { email } })}
            testID="forgot-link"
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {errors.general ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Entrar"
            icon="log-in"
            onPress={submit}
            loading={loading}
            testID="login-submit"
            style={{ marginTop: spacing.xl }}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Aún no tienes cuenta?</Text>
            <TouchableOpacity onPress={() => router.replace("/auth/register")} testID="go-register">
              <Text style={styles.footerLink}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: spacing.md,
  },
  backText: { color: colors.brand, fontSize: fontSize.md, fontWeight: "700" },
  forgot: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    marginTop: 4,
  },
  forgotText: { color: colors.brand, fontWeight: "700", fontSize: fontSize.sm, textDecorationLine: "underline" },
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
  footerRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: { color: colors.textSecondary, fontSize: fontSize.base },
  footerLink: { color: colors.brand, fontWeight: "800", fontSize: fontSize.base, textDecorationLine: "underline" },
});
