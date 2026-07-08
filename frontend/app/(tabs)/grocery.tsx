import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { api } from "@/src/api/client";
import { colors, radius, spacing, shadows } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState } from "@/src/components/EmptyState";

type GroceryItem = {
  id: string;
  household_id: string;
  item_name: string;
  category: string;
  is_bought: boolean;
  is_archived: boolean;
};

const CATEGORIES = [
  { key: "Sayuran", icon: "leaf" as const, color: "#4CAF50" },
  { key: "Bumbu Dapur", icon: "flame" as const, color: "#FF9800" },
  { key: "Daging/Protein", icon: "restaurant" as const, color: "#D96C5B" },
  { key: "Kebutuhan Rumah", icon: "home" as const, color: "#5A7FBF" },
  { key: "Lain-lain", icon: "cube" as const, color: "#78766F" },
];

export default function GroceryScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("Lain-lain");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<GroceryItem[]>("/grocery");
      setItems(r.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Real-time-ish sync via polling every 3s while viewing this screen.
      const id = setInterval(load, 3000);
      return () => clearInterval(id);
    }, [load])
  );

  const grouped = useMemo(() => {
    const map: Record<string, GroceryItem[]> = {};
    for (const c of CATEGORIES) map[c.key] = [];
    for (const it of items) {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    }
    return map;
  }, [items]);

  const boughtCount = items.filter((i) => i.is_bought).length;
  const totalCount = items.length;

  const toggle = async (item: GroceryItem) => {
    const next = !item.is_bought;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_bought: next } : i)));
    try {
      await api.put(`/grocery/${item.id}/toggle`, { is_bought: next });
    } catch {
      load();
    }
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.delete(`/grocery/${id}`);
    } catch {
      load();
    }
  };

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    try {
      const r = await api.post<GroceryItem>("/grocery", {
        item_name: name,
        category: addCategory,
      });
      setItems((prev) => [...prev, r.data]);
      setAddName("");
      setShowAdd(false);
    } catch {}
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await api.post("/grocery/archive");
      setItems([]);
      setShowArchiveConfirm(false);
      setToast("Minggu ini diarsipkan. Selamat! Halaman direset untuk minggu baru.");
      setTimeout(() => setToast(null), 3500);
    } catch {} finally {
      setArchiving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <ScreenHeader
        icon="basket"
        title="Daftar Belanja"
        subtitle="Real-time sync antar kamu & pasangan."
      />

      <View style={styles.progressWrap}>
        <View style={styles.progressCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressLabel}>Progres belanja</Text>
            <Text style={styles.progressCount} testID="grocery-progress">
              {boughtCount} / {totalCount} dibeli
            </Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressPct}>
              {totalCount === 0 ? 0 : Math.round((boughtCount / totalCount) * 100)}%
            </Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: totalCount === 0 ? "0%" : `${(boughtCount / totalCount) * 100}%` },
            ]}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : totalCount === 0 ? (
        <EmptyState
          icon="basket-outline"
          title="Daftar belanja kosong"
          desc="Tap tombol Generate di tab Menu, atau tambahkan item custom di bawah."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }} testID="grocery-list">
          {CATEGORIES.map((cat) => {
            const catItems = grouped[cat.key] || [];
            if (catItems.length === 0) return null;
            const pending = catItems.filter((i) => !i.is_bought);
            const done = catItems.filter((i) => i.is_bought);
            return (
              <View key={cat.key} style={styles.catBlock}>
                <View style={styles.catHeader}>
                  <View style={[styles.catIcon, { backgroundColor: cat.color + "22" }]}>
                    <Ionicons name={cat.icon} size={16} color={cat.color} />
                  </View>
                  <Text style={styles.catText}>{cat.key}</Text>
                  <Text style={styles.catCount}>
                    {catItems.filter((i) => i.is_bought).length}/{catItems.length}
                  </Text>
                </View>

                {pending.map((it) => (
                  <GroceryRow key={it.id} item={it} onToggle={toggle} onDelete={removeItem} />
                ))}
                {done.map((it) => (
                  <GroceryRow key={it.id} item={it} onToggle={toggle} onDelete={removeItem} />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity
          testID="grocery-add-open"
          style={styles.smallBtn}
          onPress={() => setShowAdd(true)}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.smallBtnText}>Tambah Item</Text>
        </TouchableOpacity>
        {totalCount > 0 && (
          <TouchableOpacity
            testID="grocery-archive-open"
            style={styles.archiveBtn}
            onPress={() => setShowArchiveConfirm(true)}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.archiveBtnText}>Selesai Belanja</Text>
          </TouchableOpacity>
        )}
      </View>

      {toast ? (
        <View style={styles.toast} testID="grocery-toast">
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Add custom item modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.addModal} testID="grocery-add-modal">
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Tambah item belanja</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)} testID="grocery-add-close">
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Nama item</Text>
              <TextInput
                testID="grocery-add-name"
                value={addName}
                onChangeText={setAddName}
                placeholder="Contoh: Sabun cuci, Tisu"
                placeholderTextColor={colors.mutedFg}
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Kategori</Text>
              <View style={styles.catChoices}>
                {CATEGORIES.map((c) => {
                  const active = c.key === addCategory;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      testID={`grocery-cat-${c.key}`}
                      style={[styles.catChoice, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setAddCategory(c.key)}
                    >
                      <Ionicons
                        name={c.icon}
                        size={13}
                        color={active ? "#fff" : c.color}
                      />
                      <Text style={[styles.catChoiceText, active && { color: "#fff" }]}>
                        {c.key}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                testID="grocery-add-save"
                style={[styles.primaryBtn, !addName.trim() && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={!addName.trim()}
              >
                <Text style={styles.primaryBtnText}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Archive confirm modal */}
      <Modal
        visible={showArchiveConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowArchiveConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModal} testID="archive-confirm-modal">
            <View style={styles.confirmIcon}>
              <Ionicons name="checkmark-done" size={30} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>Selesai belanja minggu ini?</Text>
            <Text style={styles.confirmDesc}>
              Semua menu & item belanja akan diarsipkan. Halaman kembali kosong untuk minggu baru,
              dan kamu bisa lihat/pakai lagi lewat tab Riwayat.
            </Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                testID="archive-cancel"
                style={styles.confirmCancel}
                onPress={() => setShowArchiveConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="archive-confirm"
                style={[styles.confirmOk, archiving && { opacity: 0.6 }]}
                onPress={handleArchive}
                disabled={archiving}
              >
                {archiving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmOkText}>Ya, Arsipkan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function GroceryRow({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem;
  onToggle: (i: GroceryItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      testID={`grocery-item-${item.id}`}
      style={styles.gRow}
      activeOpacity={0.7}
      onPress={() => onToggle(item)}
      onLongPress={() => onDelete(item.id)}
    >
      <View style={[styles.check, item.is_bought && styles.checkOn]}>
        {item.is_bought ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
      </View>
      <Text
        style={[
          styles.gText,
          item.is_bought && {
            textDecorationLine: "line-through",
            color: colors.mutedFg,
          },
        ]}
      >
        {item.item_name}
      </Text>
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        style={styles.gDelete}
        testID={`grocery-delete-${item.id}`}
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={colors.mutedFg} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  progressWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
  },
  progressLabel: { fontSize: 11, color: colors.mutedFg, fontWeight: "700", letterSpacing: 1 },
  progressCount: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 2 },
  progressBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  progressPct: { color: "#fff", fontWeight: "900", fontSize: 14 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 3 },

  catBlock: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  catText: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  catCount: { fontSize: 12, fontWeight: "700", color: colors.mutedFg },

  gRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
    minHeight: 60,
  },
  check: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  gText: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  gDelete: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomActions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 20,
    flexDirection: "row",
    gap: spacing.sm,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  smallBtnText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  archiveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    ...shadows.strong,
  },
  archiveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  toast: {
    position: "absolute",
    bottom: 90,
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

  // Modal shared
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.lg,
    justifyContent: "center",
  },
  addModal: {
    backgroundColor: colors.background,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  modalLabel: { fontSize: 13, color: colors.mutedFg, fontWeight: "700", marginTop: spacing.sm, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChoices: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  catChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChoiceText: { fontSize: 12, color: colors.text, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  confirmModal: {
    backgroundColor: colors.background,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    alignItems: "center",
  },
  confirmIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  confirmTitle: { fontSize: 18, fontWeight: "900", color: colors.text, textAlign: "center" },
  confirmDesc: {
    fontSize: 13,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  confirmRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, alignSelf: "stretch" },
  confirmCancel: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: { color: colors.text, fontWeight: "700" },
  confirmOk: {
    flex: 1.4,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmOkText: { color: "#fff", fontWeight: "800" },
});
