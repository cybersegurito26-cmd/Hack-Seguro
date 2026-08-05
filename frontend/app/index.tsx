import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { PROFILES, ProfileType } from "@/src/mock";
import { useApp } from "@/src/store";

export default function WelcomeScreen() {
  const router = useRouter();
  const { setProfile } = useApp();
  const [step, setStep] = useState<"welcome" | "profile">("welcome");
  const [selected, setSelected] = useState<ProfileType | null>("nino");

  const onStart = () => {
    if (!selected) return;
    setProfile(selected);
    router.replace("/(tabs)");
  };

  if (step === "welcome") {
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
            <FeatureItem icon="ribbon" text="Insignias y niveles" />
            <FeatureItem icon="chatbubbles" text="CiberBot te ayuda" />
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={() => setStep("profile")}
            testID="welcome-start-button"
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>Comenzar</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.brand} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setStep("welcome")}
          style={styles.backBtn}
          testID="profile-back-button"
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elige tu perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.profileList}>
        <Text style={styles.subtitle}>
          Adaptamos la experiencia para ti
        </Text>

        {PROFILES.map((p) => {
          const isSelected = selected === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.profileCard, isSelected && styles.profileCardActive]}
              onPress={() => setSelected(p.id)}
              testID={`profile-option-${p.id}`}
              activeOpacity={0.85}
            >
              <View style={[styles.profileIconWrap, { backgroundColor: p.color + "22" }]}>
                <Ionicons name={p.icon as any} size={30} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileLabel}>{p.label}</Text>
                <Text style={styles.profileDesc}>{p.desc}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  isSelected && { borderColor: colors.brand, backgroundColor: colors.brand },
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color={colors.onBrand} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, !selected && { opacity: 0.5 }]}
          onPress={onStart}
          disabled={!selected}
          testID="profile-continue-button"
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>Entrar a Hack-Seguro</Text>
          <Ionicons name="rocket" size={22} color={colors.onBrand} />
        </TouchableOpacity>
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
  safe: { flex: 1, backgroundColor: colors.surface },
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  profileList: { padding: spacing.lg, paddingBottom: 120 },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
    gap: spacing.md,
    ...shadow.card,
  },
  profileCardActive: {
    borderColor: colors.brand,
    backgroundColor: "#EEF3FB",
  },
  profileIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  profileLabel: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  profileDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow.card,
  },
  primaryBtnText: {
    color: colors.onBrand,
    fontSize: fontSize.md,
    fontWeight: "800",
  },
});
