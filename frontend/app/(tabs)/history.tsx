import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { colors, radius, spacing, shadows } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState } from "@/src/components/EmptyState";

type ArchivedWeek = {
  week_start: string;
  menu_count: number;
  menus: Array<{
    id: string;
    date: string;
    meal_type: string;
    menu_name: string;
    ingredients: string[];
  }>;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

export default function HistoryScreen() {
  const [weeks, setWeeks] = useState<ArchivedWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reusing, setReusing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const r = await api.get<ArchivedWeek[]>("/history/weeks");
      setWeeks(r.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReuse = async (weekStart: string) => {
    setReusing(weekStart);
    try {
      const r = await api.post<{ copied: number }>(`/history/reuse/${weekStart}`);
      setToast(`${r.data.copied} menu disalin ke minggu aktif ✓`);
      setTimeout(() => setToast(null), 2500);
      setTimeout(() => router.push("/(tabs)/planner"), 800);
    } catch {} finally {
      setReusing(null);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <ScreenHeader
        icon="time"
        title="Riwayat"
        subtitle="Menu & belanja minggu-minggu sebelumnya."
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : weeks.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Belum ada riwayat"
          desc="Setelah kamu selesai belanja minggu ini, riwayat menu & bahan bisa dipakai ulang di sini."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          testID="history-list"
        >
          {weeks.map((wk) => {
            const isOpen = expanded === wk.week_start;
            return (
              <View
                key={wk.week_start}
                style={styles.weekCard}
                testID={`history-week-${wk.week_start}`}
              >
                <TouchableOpacity
                  style={styles.weekHead}
                  activeOpacity={0.85}
                  onPress={() => setExpanded(isOpen ? null : wk.week_start)}
                  testID={`history-toggle-${wk.week_start}`}
                >
                  <View style={styles.weekIcon}>
                    <Ionicons name="calendar" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weekLabel}>{formatWeekLabel(wk.week_start)}</Text>
                    <Text style={styles.weekMeta}>{wk.menu_count} menu tercatat</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.mutedFg}
                  />
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.weekBody}>
                    {wk.menus.map((m) => (
                      <View key={m.id} style={styles.menuRow}>
                        <Text style={styles.menuMeta}>
                          {m.date} · {m.meal_type}
                        </Text>
                        <Text style={styles.menuName}>{m.menu_name}</Text>
                        {m.ingredients.length > 0 && (
                          <View style={styles.ingRow}>
                            {m.ingredients.slice(0, 6).map((ing) => (
                              <View key={ing} style={styles.ingChip}>
                                <Text style={styles.ingChipText}>{ing}</Text>
                              </View>
                            ))}
                            {m.ingredients.length > 6 && (
                              <Text style={styles.moreText}>+{m.ingredients.length - 6} lainnya</Text>
                            )}
                          </View>
                        )}
                      </View>
                    ))}

                    <TouchableOpacity
                      testID={`history-reuse-${wk.week_start}`}
                      style={[
                        styles.reuseBtn,
                        reusing === wk.week_start && { opacity: 0.6 },
                      ]}
                      onPress={() => handleReuse(wk.week_start)}
                      disabled={reusing === wk.week_start}
                    >
                      {reusing === wk.week_start ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="copy" size={18} color="#fff" />
                          <Text style={styles.reuseText}>Gunakan Menu Ini Lagi</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {toast ? (
        <View style={styles.toast} testID="history-toast">
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  weekCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  weekHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  weekIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
  weekMeta: { fontSize: 12, color: colors.mutedFg, marginTop: 2 },
  weekBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  menuRow: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuMeta: {
    fontSize: 11,
    color: colors.mutedFg,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  menuName: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 },
  ingRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  ingChip: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ingChipText: { fontSize: 11, color: colors.textSoft, fontWeight: "600" },
  moreText: { fontSize: 11, color: colors.mutedFg, fontWeight: "700", alignSelf: "center" },
  reuseBtn: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    ...shadows.card,
  },
  reuseText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  toast: {
    position: "absolute",
    bottom: 30,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  toastText: { color: "#fff", flex: 1, fontWeight: "600", fontSize: 13 },
});
