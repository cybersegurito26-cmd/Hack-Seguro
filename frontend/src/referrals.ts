/**
 * Ambassador / Referral link capture.
 *
 * When a user opens the app via `?ref=user_xxx` (web) or a deep-link
 * (`hackseguro://?ref=user_xxx`), we stash the id in secure storage and
 * flush it into the first successful register / Google-exchange payload.
 * The backend uses it to attribute the referral to the inviter.
 */
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { storage } from "@/src/utils/storage";

const REF_KEY = "hackseguro.pending_ref";

function parseParam(url: string | null | undefined, key: string): string | null {
  if (!url) return null;
  const re = new RegExp(`[?#&]${key}=([^&#]+)`);
  const m = url.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function captureIncomingReferral(): Promise<void> {
  try {
    let raw: string | null | undefined = null;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        raw = window.location.hash + " " + window.location.search + " " + window.location.href;
      }
    } else {
      raw = await Linking.getInitialURL();
    }
    const ref = parseParam(raw, "ref");
    if (ref) {
      await storage.secureSet(REF_KEY, ref);
    }
  } catch {
    // best effort — ignore
  }
}

export async function consumePendingReferral(): Promise<string | null> {
  const v = await storage.secureGet<string>(REF_KEY, "");
  if (!v) return null;
  await storage.secureRemove(REF_KEY);
  return v;
}

export async function peekPendingReferral(): Promise<string | null> {
  const v = await storage.secureGet<string>(REF_KEY, "");
  return v || null;
}
