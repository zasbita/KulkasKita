import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing, shadows } from "@/src/theme";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1556911261-6bd341186b2f?crop=entropy&cs=srgb&fm=jpg&w=1000&q=85";

const AUTH_BASE = "https://auth.emergentagent.com/";

export default function LoginScreen() {
  const { signInWithSessionId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processSessionId = useCallback(
    async (sessionId: string) => {
      setBusy(true);
      try {
        await signInWithSessionId(sessionId);
        // Auth gate will redirect.
      } catch (e: any) {
        setError(e?.message || "Gagal masuk. Coba lagi.");
      } finally {
        setBusy(false);
      }
    },
    [signInWithSessionId]
  );

  // Cold-start / hot deep link support (mobile)
  useEffect(() => {
    if (Platform.OS === "web") {
      // Read from window.location.hash / search
      const w = (globalThis as any).window;
      if (!w) return;
      const hash = w.location.hash || "";
      const search = w.location.search || "";
      const parse = (s: string) => {
        const m = s.match(/session_id=([^&]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      };
      const sid = parse(hash) || parse(search);
      if (sid) {
        w.history.replaceState(null, "", w.location.pathname);
        processSessionId(sid);
      }
      return;
    }

    let sub: any;
    (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) {
        const parsed = Linking.parse(initial);
        const sid = (parsed.queryParams?.session_id as string) || null;
        if (sid) processSessionId(sid);
      }
      sub = Linking.addEventListener("url", (event) => {
        const parsed = Linking.parse(event.url);
        const sid = (parsed.queryParams?.session_id as string) || null;
        if (sid) processSessionId(sid);
      });
    })();
    return () => {
      if (sub?.remove) sub.remove();
    };
  }, [processSessionId]);

  const handleLogin = useCallback(async () => {
    setError(null);
    try {
      let redirectUrl: string;
      if (Platform.OS === "web") {
        const w = (globalThis as any).window;
        redirectUrl = w.location.origin + "/";
      } else {
        redirectUrl = Linking.createURL("auth");
      }
      const authUrl = `${AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        (globalThis as any).window.location.href = authUrl;
        return;
      }

      setBusy(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        const sid =
          (parsed.queryParams?.session_id as string) ||
          extractFragmentSessionId(result.url);
        if (sid) {
          await processSessionId(sid);
        } else {
          setError("Tidak menerima session_id dari server.");
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // user canceled
      } else {
        setError("Login gagal. Coba lagi.");
      }
    } catch (e: any) {
      setError(e?.message || "Login gagal.");
    } finally {
      setBusy(false);
    }
  }, [processSessionId]);

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: HERO_IMAGE }}
        style={styles.hero}
        imageStyle={styles.heroImg}
      >
        <View style={styles.heroOverlay} />
        <SafeAreaView edges={["top"]} style={styles.heroContent}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="leaf" size={22} color={colors.primaryFg} />
            </View>
            <Text style={styles.brandText}>DapurKita</Text>
          </View>
          <Text style={styles.heroTitle}>Belanja & Meal Plan{"\n"}bareng Pasangan</Text>
          <Text style={styles.heroSub}>
            Rencanakan menu, cek stok kulkas, dan sinkronkan daftar belanja secara real-time.
          </Text>
        </SafeAreaView>
      </ImageBackground>

      <SafeAreaView edges={["bottom"]} style={styles.bottom}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Masuk untuk mulai</Text>
          <Text style={styles.cardSub}>
            Gunakan akun Google-mu. Aman, cepat, tanpa perlu ingat password.
          </Text>

          {error ? (
            <View style={styles.errorBox} testID="login-error">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            testID="google-login-button"
            style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryFg} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.primaryFg} />
                <Text style={styles.primaryBtnText}>Masuk dengan Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footNote}>
            Dengan masuk, kamu setuju berbagi data belanja dengan pasangan di household yang sama.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function extractFragmentSessionId(url: string): string | null {
  const idx = url.indexOf("#");
  if (idx < 0) return null;
  const frag = url.substring(idx + 1);
  const m = frag.match(/session_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { flex: 1.05, justifyContent: "flex-end" },
  heroImg: { resizeMode: "cover" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,35,25,0.55)",
  },
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.md,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  bottom: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: 14,
    color: colors.mutedFg,
    marginTop: 6,
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadows.card,
  },
  primaryBtnText: {
    color: colors.primaryFg,
    fontSize: 16,
    fontWeight: "700",
  },
  footNote: {
    fontSize: 12,
    color: colors.mutedFg,
    marginTop: spacing.md,
    textAlign: "center",
    lineHeight: 18,
  },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: "#FEEAE6",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: "600",
  },
});
