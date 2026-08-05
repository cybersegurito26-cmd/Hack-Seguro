import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { ESCAPE_STORY } from "@/src/mock";
import { useApp } from "@/src/store";
import { GameHeader, RewardChip } from "./fraude-real";

export default function EscapeGame() {
  const router = useRouter();
  const app = useApp();
  const [nodeId, setNodeId] = useState("start");
  const [feedback, setFeedback] = useState<null | { text: string; correct: boolean }>(null);
  const [won, setWon] = useState(false);
  const node = ESCAPE_STORY[nodeId];

  const choose = (opt: (typeof node.options)[number]) => {
    if (opt.feedback) {
      setFeedback({ text: opt.feedback, correct: !!opt.correct });
      setTimeout(() => {
        setFeedback(null);
        if (opt.next === "win") {
          app.completeGame("escape", 3, 3).catch(() => {});
          setWon(true);
        }
        setNodeId(opt.next);
      }, 900);
    } else {
      if (opt.next === "win") {
        app.completeGame("escape", 3, 3).catch(() => {});
        setWon(true);
      }
      setNodeId(opt.next);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <GameHeader title="Escape del Hacker" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.stageIcon}>
          <Ionicons
            name={nodeId === "start" || nodeId === "step2" || nodeId === "step3" ? "footsteps" : nodeId.startsWith("fail") ? "warning" : "trophy"}
            size={60}
            color={colors.accent}
          />
        </View>
        <Text style={styles.storyText}>{node.text}</Text>

        {feedback && (
          <View style={[styles.feedback, feedback.correct ? styles.feedbackOk : styles.feedbackBad]}>
            <Ionicons
              name={feedback.correct ? "checkmark-circle" : "close-circle"}
              size={22}
              color={feedback.correct ? colors.success : colors.danger}
            />
            <Text style={styles.feedbackText}>{feedback.text}</Text>
          </View>
        )}

        {nodeId === "win" ? (
          <View style={styles.rewards}>
            <RewardChip icon="star" text="+40 XP" />
            <RewardChip icon="cash" text="+20 monedas" />
          </View>
        ) : null}

        <View style={styles.optionList}>
          {node.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.option}
              onPress={() => choose(opt)}
              disabled={!!feedback}
              testID={`escape-option-${i}`}
              activeOpacity={0.9}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.brand} />
            </TouchableOpacity>
          ))}
        </View>

        {won && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.back()}
            testID="escape-finish"
          >
            <Text style={styles.primaryBtnText}>Volver a juegos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  stageIcon: {
    alignSelf: "center",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.md,
    ...shadow.strong,
  },
  storyText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 26,
    paddingHorizontal: spacing.sm,
  },
  feedback: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  feedbackOk: { backgroundColor: colors.successBg },
  feedbackBad: { backgroundColor: colors.dangerBg },
  feedbackText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  optionList: { gap: spacing.md, marginTop: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadow.card,
  },
  optionText: { flex: 1, fontSize: fontSize.base, fontWeight: "700", color: colors.textPrimary, marginRight: 8 },
  rewards: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand,
    padding: spacing.md + 2,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
});
