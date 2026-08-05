import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { BOT_INTENTS, BOT_DEFAULT, BOT_QUICK_ACTIONS } from "@/src/mock";

type Msg = {
  id: string;
  from: "bot" | "user";
  text: string;
};

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

function generateReply(input: string): string {
  const q = input.toLowerCase();
  for (const intent of BOT_INTENTS) {
    if (intent.keywords.some((k) => q.includes(k))) return intent.response;
  }
  return BOT_DEFAULT;
}

export default function CiberBotScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: nextId(),
      from: "bot",
      text: "¡Hola! Soy CiberBot 🛡️. Puedo ayudarte con phishing, contraseñas, WhatsApp y más. Nunca te pediré datos personales. ¿En qué te ayudo?",
    },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<Msg>>(null);

  const send = useCallback((text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;
    setInput("");
    const userMsg: Msg = { id: nextId(), from: "user", text: value };
    setMessages((prev) => [...prev, userMsg]);
    // Simulated typing delay
    setTimeout(() => {
      const reply: Msg = { id: nextId(), from: "bot", text: generateReply(value) };
      setMessages((prev) => [...prev, reply]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }, 500);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [input]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CiberBot</Text>
          <View style={styles.onlineRow}>
            <View style={styles.dot} />
            <Text style={styles.subtitle}>Asistente en línea · seguro y privado</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => <Bubble msg={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.quickWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {BOT_QUICK_ACTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.chip}
                onPress={() => send(q)}
                testID={`quick-action-${q}`}
                activeOpacity={0.8}
              >
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu duda…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            testID="chat-input"
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!input.trim()}
            testID="chat-send-button"
          >
            <Ionicons name="send" size={20} color={colors.onBrand} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isBot = msg.from === "bot";
  return (
    <View style={[styles.bubbleRow, isBot ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" }]}>
      {isBot && (
        <View style={styles.bubbleAvatar}>
          <Ionicons name="shield-checkmark" size={14} color={colors.brand} />
        </View>
      )}
      <View
        style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}
        testID={`chat-msg-${msg.from}`}
      >
        <Text style={[styles.bubbleText, !isBot && { color: colors.onBrand }]}>{msg.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  subtitle: { fontSize: fontSize.xs, color: colors.textSecondary },
  messages: { padding: spacing.lg, gap: spacing.md },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubbleAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleBot: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 4,
    ...shadow.card,
  },
  bubbleUser: {
    backgroundColor: colors.brand,
    borderTopRightRadius: 4,
  },
  bubbleText: { color: colors.textPrimary, fontSize: fontSize.base, lineHeight: 22 },
  quickWrap: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  quickRow: { padding: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#EEF3FB",
    borderWidth: 1,
    borderColor: colors.brand + "44",
  },
  chipText: { color: colors.brand, fontWeight: "700", fontSize: fontSize.sm },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElev,
    color: colors.textPrimary,
    fontSize: fontSize.base,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
