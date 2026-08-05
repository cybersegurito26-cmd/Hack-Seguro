import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Share as RNShare,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import QRCode from "react-native-qrcode-svg";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

export default function SchoolShareScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const code = user?.school_code || "";
  const shareUrl = api.schoolShareUrl(code);
  const posterUrl = api.schoolPosterUrl(code);

  const onShareLink = async () => {
    const message = `¡Únete a mi escuela en Hack-Seguro! Código: ${code}\n${shareUrl}`;
    try {
      await RNShare.share({ message, url: shareUrl, title: `Hack-Seguro · ${code}` });
    } catch {}
  };

  const onDownloadPoster = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.open(posterUrl, "_blank");
        return;
      }
      const filename = `hackseguro-${code}.png`;
      const dest = (FileSystem as any).cacheDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(posterUrl, dest);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartir póster" });
      }
    } catch (e) {
      console.warn("poster download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} testID="share-close">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invita a tu escuela</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.codeCard} testID="school-share-card">
          <Text style={styles.codeLabel}>Código de tu escuela</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.codeHint}>Compártelo con tus compañeros para competir en la liga.</Text>

          <View style={styles.qrWrap}>
            <QRCode value={shareUrl} size={200} color={colors.brand} backgroundColor="#fff" />
          </View>
          <Text style={styles.qrCaption}>{shareUrl}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onShareLink} testID="share-link-button" activeOpacity={0.9}>
          <Ionicons name="share-social" size={20} color={colors.onBrand} />
          <Text style={styles.primaryBtnText}>Compartir enlace</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onDownloadPoster} testID="download-poster-button" activeOpacity={0.9}>
          {downloading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <Ionicons name="image" size={20} color={colors.brand} />
              <Text style={styles.secondaryBtnText}>Descargar póster (PNG)</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.previewLabel}>Vista previa del póster</Text>
        <View style={styles.posterFrame}>
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            resizeMode="contain"
          />
        </View>

        <View style={styles.tip}>
          <Ionicons name="bulb" size={20} color={colors.warning} />
          <Text style={styles.tipText}>
            Tip: pega el póster en el salón o compártelo en el grupo de WhatsApp de padres. Cada estudiante que se una suma XP a la liga semanal de tu escuela.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    padding: spacing.md, flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, borderColor: colors.border,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElev,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: fontSize.md, fontWeight: "800", color: colors.textPrimary },
  body: { padding: spacing.lg, gap: spacing.md },
  codeCard: {
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.brand, alignItems: "center",
    ...shadow.strong,
  },
  codeLabel: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.xs, textTransform: "uppercase", fontWeight: "800", letterSpacing: 1 },
  code: { color: colors.accent, fontSize: 44, fontWeight: "900", marginTop: 6 },
  codeHint: { color: colors.onBrand, opacity: 0.9, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.sm },
  qrWrap: {
    marginTop: spacing.lg, padding: spacing.md,
    backgroundColor: "#fff", borderRadius: radius.md,
  },
  qrCaption: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs, marginTop: spacing.sm },
  primaryBtn: {
    marginTop: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    padding: spacing.md + 2, borderRadius: radius.pill, backgroundColor: colors.brand,
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: fontSize.md },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.accent,
    minHeight: 48,
  },
  secondaryBtnText: { color: colors.brand, fontWeight: "800", fontSize: fontSize.md },
  previewLabel: { marginTop: spacing.md, fontWeight: "800", color: colors.textPrimary, fontSize: fontSize.base },
  posterFrame: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    padding: spacing.sm, ...shadow.card, alignItems: "center",
  },
  poster: { width: "100%", aspectRatio: 9 / 16, borderRadius: radius.sm },
  tip: {
    marginTop: spacing.md,
    padding: spacing.md, backgroundColor: colors.warningBg, borderRadius: radius.md,
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
  },
  tipText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, lineHeight: 20 },
});
