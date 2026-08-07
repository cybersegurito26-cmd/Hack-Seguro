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
import { useRouter, useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing, fontSize } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { AuthField, PrimaryButton, AuthHeader } from "@/src/components/AuthUI";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState((params.email as string) || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Ingresa un correo válido");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      router.push({ pathname: "/auth/reset", params: { email: email.trim().toLowerCase() } });
    } catch (e: any) {
      // Server always returns 200 for forgot, but handle rate limit
      if (e?.status === 429) {
        setError("Demasiados intentos. Prueba en 15 minutos.");
      } else {
        setError(e?.message || "No se pudo enviar el código");
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
            emoji="🔑"
            title="Recupera tu acceso"
            subtitle="Te enviaremos un código de 6 dígitos a tu correo. Es válido por 10 minutos."
          />

          <AuthField
            label="Correo electrónico"
            icon="mail"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChangeText={(v) => { setEmail(v); if (error) setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={error}
            testID="forgot-email"
          />

          <View style={styles.tipCard}>
            <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
            <Text style={styles.tipText}>
              <Text style={{ fontWeight: "800" }}>Hack-Bot te recuerda:</Text> nunca compartas el código con nadie, ni siquiera con Hack-Seguro. Nosotros no lo pediremos.
            </Text>
          </View>

          <PrimaryButton
            label="Enviar código"
            icon="send"
            onPress={submit}
            loading={loading}
            testID="forgot-submit"
            style={{ marginTop: spacing.xl }}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Recordaste tu contraseña?</Text>
            <TouchableOpacity onPress={() => router.replace("/auth/login")} testID="back-to-login">
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
  tipCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "#EEF3FB",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#D6E2F0",
  },
  tipText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 20 },
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
