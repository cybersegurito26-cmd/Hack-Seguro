import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
        tabBarStyle: {
          backgroundColor: colors.surfaceAlt,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Aprende",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "book" : "book-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-learn",
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Juegos",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "game-controller" : "game-controller-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-games",
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: "CiberBot",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-chatbot",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: any; color: string }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={24} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", marginTop: 2 },
});
