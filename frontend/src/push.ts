// Push notifications registration for Hack-Seguro.
// Uses Emergent-managed push relay via `/api/register-push`.
// Only registers when running in a native build (not Expo Go).
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { api } from "@/src/api";

let registered = false;
let handlerConfigured = false;

/**
 * Requests permission and registers the device push token with the backend.
 * Safe no-op on web / Expo Go where push tokens aren't available.
 *
 * NOTE: Nothing from `expo-notifications` runs at module import time — this
 * avoids the "Expo Go doesn't support push notifications" crash. The
 * `setNotificationHandler` call is deferred until the first real registration
 * attempt on a proper native build.
 */
export async function registerForPush(userId: string) {
  if (registered) return;
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    // Push notifications don't work in Expo Go — do not touch expo-notifications APIs
    return;
  }
  try {
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00357a",
      });
    }

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const platform = Platform.OS === "ios" ? "ios" : "android";
    await api.registerPush(userId, platform, tokenResp.data);
    registered = true;
  } catch (e) {
    // Silent — push is optional
    console.log("[push] registration skipped:", (e as any)?.message);
  }
}
