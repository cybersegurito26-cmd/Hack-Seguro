import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function EntryScreen() {
  const router = useRouter();
  const { loading, user, loginWithGoogle } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (!user.school_code) {
        router.replace("/join-school");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.welcomeContainer, { justifyContent: "center" }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.tagline, { marginTop: spacing.md }]}>
            Preparando Hack-Seguro…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.welcomeContainer} testID="welcome-screen">
        <View style={styles.mascotWrap}>
          <View style={styles.mascotShadow} />
          <View style={styles.mascot} testID="mascot">
            <Ionicons name="shield-checkmark" size={110} color={colors.brand} />
            <View style={styles.eye} />
            <View style={[styles.eye, { right: 62 }]} />
            <View style={styles.smile} />
          </View>
        </View>

        <Text style={styles.brand} testID="brand-title">
          Hack-Seguro
        </Text>
        <Text style={styles.tagline}>
          Aprende ciberseguridad{"\n"}jugando cada día 🛡️
        </Text>

        <View style={styles.features}>
          <FeatureItem icon="game-controller" text="Juegos divertidos" />
          <FeatureItem icon="trophy" text="Liga semanal de tu escuela" />
          <FeatureItem icon="chatbubbles" text="Hack-Bot con IA en español" />
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={loginWithGoogle}
          testID="google-login-button"
          activeOpacity={0.9}
        >
          <Ionicons name="logo-google" size={22} color={colors.brand} />
          <Text style={styles.ctaText}>Continuar con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaSecondary}
          onPress={() => router.push("/auth/login")}
          testID="email-login-button"
          activeOpacity={0.9}
        >
          <Ionicons name="mail" size={20} color={colors.onBrand} />
          <Text style={styles.ctaSecondaryText}>Iniciar sesión con correo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaOutline}
          onPress={() => router.push("/auth/register")}
          testID="email-register-button"
          activeOpacity={0.9}
        >
          <Text style={styles.ctaOutlineText}>Crear cuenta nueva</Text>
        </TouchableOpacity>

        <Text style={styles.footerLegal}>
          Hack-Seguro · Prevención de ciberdelitos en México
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.brand,
  },
  mascotWrap: { alignItems: "center", marginBottom: spacing.xl },
  mascot: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.strong,
  },
  mascotShadow: {
    position: "absolute",
    bottom: -8,
    width: 120,
    height: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  eye: {
    position: "absolute",
    top: 55,
    left: 62,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  smile: {
    position: "absolute",
    bottom: 42,
    width: 32,
    height: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 3,
    borderColor: colors.brand,
  },
  brand: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.onBrand,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.onBrand,
    textAlign: "center",
    marginTop: spacing.md,
    opacity: 0.9,
    lineHeight: 24,
  },
  features: {
    marginTop: spacing.xl,
    width: "100%",
    gap: spacing.md,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(208,232,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { color: colors.onBrand, fontSize: fontSize.base, fontWeight: "600" },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    minHeight: 56,
    ...shadow.card,
  },
  ctaText: {
    color: colors.brand,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  ctaSecondary: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    minHeight: 52,
  },
  ctaSecondaryText: {
    color: colors.onBrand,
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  ctaOutline: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 44,
  },
  ctaOutlineText: {
    color: colors.accent,
    fontSize: fontSize.base,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  footerLegal: {
    marginTop: spacing.md,
    color: "rgba(255,255,255,0.7)",
    fontSize: fontSize.xs,
    textAlign: "center",
  },
});
