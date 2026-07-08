import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, radius, spacing, shadows } from "@/src/theme";

type Mode = "choose" | "create" | "join";

export default function HouseholdScreen() {
  const { user, refresh, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("Rumah Kami");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.post("/household/create", { name: name.trim() || "Rumah Kami" });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Gagal membuat household");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Masukkan kode undangan");
      return;
    }
    setBusy(true);
    try {
      await api.post("/household/join", { invite_code: code.trim().toUpperCase() });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Gagal bergabung");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="home" size={22} color={colors.primaryFg} />
            </View>
            <TouchableOpacity onPress={signOut} testID="household-signout">
              <Text style={styles.signOutText}>Keluar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hi} testID="household-greeting">
            Halo, {user?.name?.split(" ")[0] || "kamu"} 👋
          </Text>
          <Text style={styles.title}>Ayo mulai dari household</Text>
          <Text style={styles.sub}>
            Satu household berisi 2 akun (kamu & pasangan). Buat baru, atau gabung pakai kode undangan.
          </Text>

          {mode === "choose" && (
            <View style={styles.optionsWrap}>
              <TouchableOpacity
                testID="household-mode-create"
                style={styles.optionCard}
                activeOpacity={0.85}
                onPress={() => setMode("create")}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Buat Household Baru</Text>
                  <Text style={styles.optionSub}>
                    Bikin rumah baru, dapatkan kode undangan untuk pasangan.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedFg} />
              </TouchableOpacity>

              <TouchableOpacity
                testID="household-mode-join"
                style={styles.optionCard}
                activeOpacity={0.85}
                onPress={() => setMode("join")}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
                  <Ionicons name="people" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Gabung dengan Kode</Text>
                  <Text style={styles.optionSub}>
                    Sudah punya kode undangan dari pasangan? Masukkan di sini.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>
          )}

          {mode === "create" && (
            <View style={styles.formCard}>
              <TouchableOpacity onPress={() => setMode("choose")} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={18} color={colors.text} />
                <Text style={styles.backText}>Kembali</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>Buat Household Baru</Text>
              <Text style={styles.label}>Nama Household</Text>
              <TextInput
                testID="household-name-input"
                value={name}
                onChangeText={setName}
                placeholder="Rumah Kami"
                placeholderTextColor={colors.mutedFg}
                style={styles.input}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                testID="household-create-submit"
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Buat Household</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {mode === "join" && (
            <View style={styles.formCard}>
              <TouchableOpacity onPress={() => setMode("choose")} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={18} color={colors.text} />
                <Text style={styles.backText}>Kembali</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>Gabung Household</Text>
              <Text style={styles.label}>Kode Undangan</Text>
              <TextInput
                testID="household-code-input"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="Contoh: 3K9F2A"
                placeholderTextColor={colors.mutedFg}
                autoCapitalize="characters"
                maxLength={8}
                style={[styles.input, { letterSpacing: 4, textAlign: "center", fontSize: 22 }]}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                testID="household-join-submit"
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={handleJoin}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Gabung Sekarang</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: colors.mutedFg,
    fontSize: 14,
    fontWeight: "600",
  },
  hi: { fontSize: 14, color: colors.mutedFg, marginTop: spacing.sm, fontWeight: "600" },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  sub: {
    fontSize: 15,
    color: colors.textSoft,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  optionsWrap: { marginTop: spacing.xl, gap: spacing.md },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.card,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  optionSub: { fontSize: 13, color: colors.mutedFg, marginTop: 2, lineHeight: 18 },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
    ...shadows.card,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  backText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  formTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.mutedFg, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.destructive, marginTop: spacing.sm, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  primaryBtnText: { color: colors.primaryFg, fontSize: 16, fontWeight: "700" },
});
