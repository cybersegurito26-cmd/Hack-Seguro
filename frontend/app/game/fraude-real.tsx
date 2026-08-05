import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { FRAUD_CARDS } from "@/src/mock";
import { useApp } from "@/src/store";

export default function FraudeRealGame() {
  const router = useRouter();
  const app = useApp();
  const cards = useMemo(() => FRAUD_CARDS, []);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<null | { correct: boolean; explanation: string }>(null);

  const done = index >= cards.length;
  const current = cards[index];

  const answer = (choseFraud: boolean) => {
    if (!current || feedback) return;
    const correct = choseFraud === current.isFraud;
    if (correct) setScore((s) => s + 1);
    setFeedback({ correct, explanation: current.explanation });
  };

  const next = () => {
    setFeedback(null);
    setIndex((i) => i + 1);
  };

  const finish = async () => {
    try {
      await app.completeGame("fraude", score, cards.length);
    } catch {}
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <GameHeader title="¿Fraude o Real?" onClose={() => router.back()} score={score} total={cards.length} />

      {done ? (
        <View style={styles.doneScreen}>
          <Ionicons name="trophy" size={90} color={colors.warning} />
          <Text style={styles.doneTitle}>¡Juego terminado!</Text>
          <Text style={styles.doneSub}>Aciertos: {score} / {cards.length}</Text>
          <View style={styles.rewards}>
            <RewardChip icon="star" text="+30 XP" />
            <RewardChip icon="cash" text={`+${score * 2} monedas`} />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={finish} testID="game-finish-button">
            <Text style={styles.primaryBtnText}>Volver a juegos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.counter}>Carta {index + 1} de {cards.length}</Text>
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="mail" size={30} color={colors.brand} />
            </View>
            <Text style={styles.cardLabel}>Mensaje recibido</Text>
            <Text style={styles.cardText}>{current.text}</Text>
          </View>

          {feedback ? (
            <View style={[styles.feedback, feedback.correct ? styles.feedbackOk : styles.feedbackBad]}>
              <Ionicons
                name={feedback.correct ? "checkmark-circle" : "close-circle"}
                size={26}
                color={feedback.correct ? colors.success : colors.danger}
              />
              <Text style={styles.feedbackText}>{feedback.explanation}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.danger }]}
              onPress={() => answer(true)}
              disabled={!!feedback}
              testID="btn-fraude"
              activeOpacity={0.85}
            >
              <Ionicons name="alert" size={26} color={colors.onBrand} />
              <Text style={styles.actionText}>¡Fraude!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
              onPress={() => answer(false)}
              disabled={!!feedback}
              testID="btn-real"
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={26} color={colors.onBrand} />
              <Text style={styles.actionText}>Real</Text>
            </TouchableOpacity>
          </View>

          {feedback && (
            <TouchableOpacity style={styles.primaryBtn} onPress={next} testID="btn-next-card">
              <Text style={styles.primaryBtnText}>Siguiente</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

export function GameHeader({ title, onClose, score, total }: { title: string; onClose: () => void; score?: number; total?: number }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="game-close">
        <Ionicons name="close" size={26} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {typeof score === "number" && typeof total === "number" ? (
        <View style={styles.scoreChip}>
          <Ionicons name="star" size={16} color={colors.warning} />
          <Text style={styles.scoreText}>{score}/{total}</Text>
        </View>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

export function RewardChip({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.rewardChip}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.rewardText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElev,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary },
  scoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  scoreText: { color: colors.warning, fontWeight: "800", fontSize: fontSize.sm },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  counter: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: "center" },
  card: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF3FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  cardLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },
  cardText: { fontSize: fontSize.base, color: colors.textPrimary, marginTop: 6, lineHeight: 22 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    gap: 6,
    ...shadow.card,
  },
  actionText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
  feedback: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  feedbackOk: { backgroundColor: colors.successBg },
  feedbackBad: { backgroundColor: colors.dangerBg },
  feedbackText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    padding: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
  doneScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  doneTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary, marginTop: spacing.md },
  doneSub: { fontSize: fontSize.md, color: colors.textSecondary },
  rewards: { flexDirection: "row", gap: spacing.md, marginVertical: spacing.md },
  rewardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  rewardText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.sm },
});
