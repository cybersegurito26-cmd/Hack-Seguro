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
          <FeatureItem icon="chatbubbles" text="CiberBot con IA en español" />
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={loginWithGoogle}
          testID="google-login-button"
          activeOpacity={0.9}
        >
          <Ionicons name="logo-google" size={22} color={colors.brand} />
          <Text style={styles.ctaText}>Entrar con Google</Text>
        </TouchableOpacity>

        <Text style={styles.footerLegal}>
          Emergent Auth · No pedimos ni guardamos contraseñas
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
    marginTop: spacing.xxl,
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
    marginTop: spacing.xxl,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.card,
  },
  ctaText: {
    color: colors.brand,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
  footerLegal: {
    marginTop: spacing.md,
    color: "rgba(255,255,255,0.7)",
    fontSize: fontSize.xs,
    textAlign: "center",
  },
});
