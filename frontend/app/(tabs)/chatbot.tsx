import React, { useState, useRef, useCallback, useEffect } from "react";
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
import { BOT_QUICK_ACTIONS } from "@/src/mock";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Msg = { id: string; from: "bot" | "user"; text: string };

let idCounter = 0;
const nextId = () => `${Date.now()}-${idCounter++}`;

export default function CiberBotScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sessionRef = useRef<string>(`sess-${Date.now()}`);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: nextId(),
      from: "bot",
      text: `¡Hola${user?.name ? ", " + user.name.split(" ")[0] : ""}! Soy CiberBot 🛡️. Pregúntame sobre phishing, contraseñas, WhatsApp, fraudes bancarios y más. Nunca te pediré datos personales.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const send = useCallback(async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || sending) return;
    setInput("");
    setSending(true);
    const userMsg: Msg = { id: nextId(), from: "user", text: value };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.chat(sessionRef.current, value);
      setMessages((prev) => [...prev, { id: nextId(), from: "bot", text: res.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), from: "bot", text: "Ups, no pude responder ahora. Intenta de nuevo en un momento." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [input, sending]);

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
            <Text style={styles.subtitle}>Claude Sonnet 4.6 · seguro y privado</Text>
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

        {sending && (
          <View style={styles.typing} testID="chat-typing">
            <View style={styles.bubbleAvatar}>
              <Ionicons name="shield-checkmark" size={14} color={colors.brand} />
            </View>
            <Text style={styles.typingText}>CiberBot está pensando…</Text>
          </View>
        )}

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
                disabled={sending}
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
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
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
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  subtitle: { fontSize: fontSize.xs, color: colors.textSecondary },
  messages: { padding: spacing.lg, gap: spacing.md },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubbleAvatar: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  bubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radius.lg },
  bubbleBot: { backgroundColor: colors.surfaceAlt, borderTopLeftRadius: 4, ...shadow.card },
  bubbleUser: { backgroundColor: colors.brand, borderTopRightRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: fontSize.base, lineHeight: 22 },
  typing: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  typingText: { color: colors.textSecondary, fontSize: fontSize.sm, fontStyle: "italic" },
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
    flexDirection: "row", alignItems: "flex-end",
    padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderColor: colors.border,
  },
  input: {
    flex: 1, maxHeight: 100, minHeight: 42,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.lg, backgroundColor: colors.surfaceElev,
    color: colors.textPrimary, fontSize: fontSize.base,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
});
