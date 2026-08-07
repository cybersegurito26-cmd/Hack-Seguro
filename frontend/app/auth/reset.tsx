import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing, radius, fontSize } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { AuthField, PrimaryButton, AuthHeader } from "@/src/components/AuthUI";

export default function ResetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { resetPassword, requestPasswordReset } = useAuth();

  const [email] = useState((params.email as string) || "");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  const setDigit = (i: number, v: string) => {
    // Support paste: if the user pastes a 6-digit code into any input
    const digitsOnly = v.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      const arr = digitsOnly.slice(0, 6 - i).split("");
      const next = [...digits];
      for (let k = 0; k < arr.length; k++) next[i + k] = arr[k];
      setDigits(next);
      const nextIndex = Math.min(i + arr.length, 5);
      inputs.current[nextIndex]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = digitsOnly.slice(-1);
    setDigits(next);
    if (digitsOnly && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyPress = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
    }
  };

  const submit = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Ingresa los 6 dígitos del código");
      return;
    }
    if (password.length < 8) {
      setError("La nueva contraseña debe tener mínimo 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const user = await resetPassword(email, code, password);
      setSuccess("¡Tu contraseña fue actualizada con éxito! 🎉");
      setTimeout(() => {
        if (!user.school_code) router.replace("/join-school");
        else router.replace("/(tabs)");
      }, 900);
    } catch (e: any) {
      if (e?.status === 400) setError("El código es inválido o expiró. Intenta reenviar.");
      else if (e?.status === 422) setError("Revisa los datos ingresados.");
      else setError(e?.message || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSuccess("Enviamos un nuevo código a tu correo.");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (e: any) {
      if (e?.status === 429) setError("Demasiados intentos. Prueba en 15 minutos.");
      else setError(e?.message || "No se pudo reenviar el código");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    // Focus first digit on mount
    setTimeout(() => inputs.current[0]?.focus(), 300);
  }, []);

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
            emoji="✉️"
            title="Ingresa el código"
            subtitle={email ? `Enviamos un código a ${email}` : "Revisa tu bandeja de entrada y spam"}
          />

          <Text style={styles.label}>Código de 6 dígitos</Text>
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={(e) => onKeyPress(i, e.nativeEvent.key)}
                style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                keyboardType="number-pad"
                maxLength={6}
                textContentType={i === 0 ? "oneTimeCode" : "none"}
                autoComplete={i === 0 ? "sms-otp" : "off"}
                selectTextOnFocus
                testID={`otp-${i}`}
              />
            ))}
          </View>

          <TouchableOpacity onPress={resend} disabled={resending} style={styles.resend} testID="resend-code">
            <Text style={styles.resendText}>
              {resending ? "Reenviando…" : "¿No te llegó? Reenviar código"}
            </Text>
          </TouchableOpacity>

          <View style={{ height: spacing.md }} />
          <AuthField
            label="Nueva contraseña"
            icon="lock-closed"
            placeholder="Al menos 8 caracteres"
            value={password}
            onChangeText={(v) => { setPassword(v); if (error) setError(null); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete="new-password"
            testID="reset-password"
            rightAdornment={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
                <Ionicons name={showPw ? "eye-off" : "eye"} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />
          <View style={{ height: spacing.md }} />
          <AuthField
            label="Confirmar contraseña"
            icon="checkmark-circle"
            placeholder="Repite la nueva contraseña"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); if (error) setError(null); }}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            testID="reset-confirm"
          />

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Cambiar contraseña"
            icon="shield-checkmark"
            onPress={submit}
            loading={loading}
            testID="reset-submit"
            style={{ marginTop: spacing.xl }}
          />
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
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900",
    color: colors.brand,
    backgroundColor: colors.surfaceAlt,
  },
  otpBoxFilled: {
    borderColor: colors.brand,
    backgroundColor: "#EEF3FB",
  },
  resend: {
    marginTop: spacing.md,
    alignSelf: "center",
    paddingVertical: 8,
  },
  resendText: { color: colors.brand, fontWeight: "700", textDecorationLine: "underline", fontSize: fontSize.sm },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: { color: colors.danger, flex: 1, fontWeight: "600", fontSize: fontSize.sm },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.successBg,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  successText: { color: colors.success, flex: 1, fontWeight: "700", fontSize: fontSize.sm },
});
