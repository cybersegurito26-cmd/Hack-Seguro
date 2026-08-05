import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { loading, user } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/" />;
  if (!user.school_code) return <Redirect href="/join-school" />;

  const isTeacherOrParent = user.role === "teacher" || user.role === "parent";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
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
        name="league"
        options={{
          title: "Liga",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "trophy" : "trophy-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-league",
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
      <Tabs.Screen
        name="teacher"
        options={{
          title: "Panel",
          href: isTeacherOrParent ? "/(tabs)/teacher" : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "briefcase" : "briefcase-outline"} color={color} />
          ),
          tabBarButtonTestID: "tab-teacher",
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: any; color: string }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center", marginTop: 2 },
});
