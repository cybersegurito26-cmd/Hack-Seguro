import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { MODULES } from "@/src/mock";
import { useApp } from "@/src/store";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const app = useApp();

  const module = useMemo(() => MODULES.find((m) => m.id === id), [id]);
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!module) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Lección no encontrada</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const step = module.lessons[stepIndex];
  const total = module.lessons.length;
  const progress = ((stepIndex + (checked ? 1 : 0)) / total) * 100;
  const isCorrect = selected !== null && selected === step.correctIndex;

  const onCheck = () => {
    if (selected === null) return;
    setChecked(true);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      app.loseHeart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const onContinue = () => {
    setChecked(false);
    setSelected(null);
    if (stepIndex + 1 < total) {
      setStepIndex((i) => i + 1);
    } else {
      // finished lesson
      const earnedXp = correctCount * 10 + (isCorrect ? 10 : 0);
      const earnedCoins = 5 + (correctCount + (isCorrect ? 1 : 0));
      app.addXP(earnedXp);
      app.addCoins(earnedCoins);
      app.completeLesson(module.id);
      // simple badge unlocks
      if (module.id === "passwords") app.unlockBadge("guardian");
      if (module.id === "phishing") app.unlockBadge("phishcazador");
      setFinished(true);
    }
  };

  if (finished) {
    const totalCorrect = correctCount;
    const percent = Math.round((totalCorrect / total) * 100);
    const stars = totalCorrect === total ? 3 : totalCorrect >= total - 1 ? 2 : 1;
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.finishScreen}>
          <View style={[styles.finishIcon, { backgroundColor: module.color }]}>
            <Ionicons name="trophy" size={70} color={colors.accent} />
          </View>
          <Text style={styles.finishTitle}>¡Lección completada!</Text>
          <Text style={styles.finishSub}>{module.title}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3].map((n) => (
              <Ionicons
                key={n}
                name={n <= stars ? "star" : "star-outline"}
                size={44}
                color={n <= stars ? colors.warning : colors.textMuted}
              />
            ))}
          </View>

          <View style={styles.finishStats}>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatValue}>{percent}%</Text>
              <Text style={styles.finishStatLabel}>Aciertos</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatValue}>+{correctCount * 10}</Text>
              <Text style={styles.finishStatLabel}>XP</Text>
            </View>
            <View style={styles.finishStat}>
              <Text style={styles.finishStatValue}>+{5 + correctCount}</Text>
              <Text style={styles.finishStatLabel}>Monedas</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.back()}
            testID="lesson-finish-button"
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Volver a la ruta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} testID="lesson-close-button">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.heartsChip}>
          <Ionicons name="heart" size={18} color={colors.danger} />
          <Text style={styles.heartsText}>{app.hearts}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.stepKind}>
          {step.kind === "spot" ? "Detecta el fraude" : step.kind === "truefalse" ? "Verdadero o Falso" : "Elige la respuesta correcta"}
        </Text>
        <Text style={styles.prompt}>{step.prompt}</Text>

        {step.context && (
          <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.textSecondary} />
              <Text style={styles.contextLabel}>Mensaje recibido</Text>
            </View>
            <Text style={styles.contextText}>{step.context}</Text>
          </View>
        )}

        <View style={styles.options}>
          {step.options?.map((opt, i) => {
            const isSel = selected === i;
            const showCorrect = checked && i === step.correctIndex;
            const showWrong = checked && isSel && i !== step.correctIndex;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.option,
                  isSel && !checked && styles.optionSel,
                  showCorrect && styles.optionCorrect,
                  showWrong && styles.optionWrong,
                ]}
                onPress={() => !checked && setSelected(i)}
                disabled={checked}
                testID={`option-${i}`}
                activeOpacity={0.85}
              >
                <View style={styles.optionRadio}>
                  {isSel && !checked && <View style={styles.optionRadioDot} />}
                  {showCorrect && <Ionicons name="checkmark" size={18} color={colors.success} />}
                  {showWrong && <Ionicons name="close" size={18} color={colors.danger} />}
                </View>
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Feedback + CTA */}
      <View
        style={[
          styles.footer,
          checked && (isCorrect ? styles.footerCorrect : styles.footerWrong),
        ]}
      >
        {checked && (
          <View style={styles.feedbackRow}>
            <Ionicons
              name={isCorrect ? "checkmark-circle" : "close-circle"}
              size={26}
              color={isCorrect ? colors.success : colors.danger}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.feedbackTitle, { color: isCorrect ? colors.success : colors.danger }]}>
                {isCorrect ? "¡Excelente!" : "Casi, intenta recordar esto"}
              </Text>
              <Text style={styles.feedbackExpl}>{step.explanation}</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            !checked && selected === null && { opacity: 0.5 },
          ]}
          onPress={checked ? onContinue : onCheck}
          disabled={!checked && selected === null}
          testID={checked ? "lesson-continue-button" : "lesson-check-button"}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>{checked ? "Continuar" : "Comprobar"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.lg },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElev,
  },
  progressBar: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surfaceElev,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  heartsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heartsText: { color: colors.danger, fontWeight: "800", fontSize: fontSize.sm },

  content: { padding: spacing.lg, paddingBottom: 200 },
  stepKind: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  prompt: { fontSize: fontSize.lg, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.sm, lineHeight: 28 },
  contextCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  contextHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  contextLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "700", textTransform: "uppercase" },
  contextText: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: 22 },

  options: { marginTop: spacing.xl, gap: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionSel: { borderColor: colors.brand, backgroundColor: "#EEF3FB" },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successBg },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  optionRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  optionRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },
  optionText: { flex: 1, fontSize: fontSize.base, fontWeight: "600", color: colors.textPrimary },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  footerCorrect: { backgroundColor: colors.successBg },
  footerWrong: { backgroundColor: colors.dangerBg },
  feedbackRow: { flexDirection: "row", gap: spacing.sm },
  feedbackTitle: { fontSize: fontSize.md, fontWeight: "800" },
  feedbackExpl: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: 4, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.onBrand, fontSize: fontSize.md, fontWeight: "800" },

  finishScreen: {
    flex: 1,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  finishIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.strong,
  },
  finishTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.lg },
  finishSub: { fontSize: fontSize.base, color: colors.textSecondary },
  starsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  finishStats: {
    flexDirection: "row",
    marginTop: spacing.xl,
    gap: spacing.md,
    width: "100%",
  },
  finishStat: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...shadow.card,
  },
  finishStatValue: { fontSize: fontSize.lg, fontWeight: "800", color: colors.brand },
  finishStatLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
