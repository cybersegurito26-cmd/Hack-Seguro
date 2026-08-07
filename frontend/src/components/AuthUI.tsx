import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, fontSize, shadow } from "@/src/theme";

type FieldProps = TextInputProps & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  containerStyle?: ViewStyle;
  rightAdornment?: React.ReactNode;
};

export function AuthField({ label, icon, error, containerStyle, rightAdornment, style, ...rest }: FieldProps) {
  return (
    <View style={[{ width: "100%" }, containerStyle]}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.wrap, error ? fieldStyles.wrapError : null]}>
        {icon ? <Ionicons name={icon} size={20} color={colors.textSecondary} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[fieldStyles.input, style]}
          {...rest}
        />
        {rightAdornment ? <View style={{ marginLeft: 8 }}>{rightAdornment}</View> : null}
      </View>
      {error ? <Text style={fieldStyles.err}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  wrapError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: "600",
    paddingVertical: 12,
  },
  err: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: "600",
  },
});

type ButtonProps = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = "primary",
  style,
  testID,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        btnStyles.base,
        isPrimary && btnStyles.primary,
        isSecondary && btnStyles.secondary,
        isGhost && btnStyles.ghost,
        (disabled || loading) && btnStyles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.brand : colors.onBrand} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={20}
              color={isPrimary ? colors.brand : isGhost ? colors.brand : colors.onBrand}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text
            style={[
              btnStyles.text,
              isPrimary && btnStyles.textPrimary,
              isSecondary && btnStyles.textSecondary,
              isGhost && btnStyles.textGhost,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primary: {
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  secondary: {
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: { opacity: 0.55 },
  text: { fontWeight: "800", fontSize: fontSize.md },
  textPrimary: { color: colors.brand },
  textSecondary: { color: colors.onBrand },
  textGhost: { color: colors.brand, textDecorationLine: "underline" },
});

export function AuthHeader({
  title,
  subtitle,
  emoji,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
}) {
  return (
    <View style={headerStyles.wrap}>
      {emoji ? <Text style={headerStyles.emoji}>{emoji}</Text> : null}
      <Text style={headerStyles.title}>{title}</Text>
      {subtitle ? <Text style={headerStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  emoji: { fontSize: 56, marginBottom: 4 },
  title: {
    color: colors.brand,
    fontSize: fontSize.xxl,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "500",
  },
});
