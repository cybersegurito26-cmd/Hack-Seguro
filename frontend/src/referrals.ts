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

// Whitelist for valid inviter ids emitted by the backend.
// Format: user_ + 12 hex chars. This prevents storing garbage from a malformed URL.
const REF_VALIDATOR = /^user_[a-f0-9]{6,32}$/i;

/**
 * Extract the value of `?key=...` from a URL fragment.
 * Whitespace, `&`, and `#` all terminate the value — never combine multiple
 * URL fragments into a single haystack before calling this (spaces would be
 * captured as part of the value on web).
 */
function parseParam(url: string | null | undefined, key: string): string | null {
  if (!url) return null;
  const re = new RegExp(`[?#&]${key}=([^&#\\s]+)`);
  const m = url.match(re);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Return the first non-null value found across the provided candidates.
 */
function firstMatch(candidates: (string | null | undefined)[], key: string): string | null {
  for (const c of candidates) {
    const v = parseParam(c, key);
    if (v) return v;
  }
  return null;
}

export async function captureIncomingReferral(): Promise<void> {
  try {
    let ref: string | null = null;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        // Parse each URL fragment SEPARATELY (never concatenate — that leaks
        // whitespace into the capture group and stores garbled ids).
        ref = firstMatch(
          [window.location.search, window.location.hash, window.location.href],
          "ref",
        );
      }
    } else {
      const initial = await Linking.getInitialURL();
      ref = parseParam(initial, "ref");
    }
    if (ref && REF_VALIDATOR.test(ref)) {
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
  // Extra safety in case an older malformed value was persisted before this fix.
  if (!REF_VALIDATOR.test(v)) return null;
  return v;
}

export async function peekPendingReferral(): Promise<string | null> {
  const v = await storage.secureGet<string>(REF_KEY, "");
  if (!v || !REF_VALIDATOR.test(v)) return null;
  return v;
}
