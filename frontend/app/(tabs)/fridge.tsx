import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { api } from "@/src/api/client";
import { colors, radius, spacing, shadows } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState } from "@/src/components/EmptyState";

type FridgeItem = {
  id: string;
  household_id: string;
  item_name: string;
  created_at: string;
};

const SUGGESTIONS = [
  "Telur",
  "Bawang Merah",
  "Bawang Putih",
  "Cabai Merah",
  "Tahu",
  "Tempe",
  "Ayam",
  "Wortel",
  "Kentang",
  "Kecap",
];

export default function FridgeScreen() {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<FridgeItem[]>("/fridge");
      setItems(r.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(load, 4000);
      return () => clearInterval(id);
    }, [load])
  );

  const addItem = async (name?: string) => {
    const val = (name ?? input).trim();
    if (!val) return;
    setInput("");
    try {
      const r = await api.post<FridgeItem>("/fridge", { item_name: val });
      setItems((prev) => [r.data, ...prev]);
    } catch {}
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.delete(`/fridge/${id}`);
    } catch {
      load();
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader
          icon="snow"
          title="Stok Kulkas"
          subtitle="Bahan yang sudah ada di rumah — biar nggak beli dobel."
        />

        <View style={styles.addRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color={colors.mutedFg} />
            <TextInput
              testID="fridge-input"
              value={input}
              onChangeText={setInput}
              placeholder="Ketik nama bahan..."
              placeholderTextColor={colors.mutedFg}
              style={styles.input}
              onSubmitEditing={() => addItem()}
              returnKeyType="done"
            />
          </View>
          <TouchableOpacity
            testID="fridge-add-button"
            style={styles.addBtn}
            onPress={() => addItem()}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.chipsRow}>
          <FlatList
            data={SUGGESTIONS}
            keyExtractor={(x) => x}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`fridge-suggest-${item}`}
                style={styles.chip}
                onPress={() => addItem(item)}
              >
                <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="snow-outline"
            title="Kulkas kosong 🧊"
            desc="Tambahkan bahan di atas biar sistem tahu apa yang sudah kamu punya."
          />
        ) : (
          <FlatList
            testID="fridge-list"
            data={items}
            keyExtractor={(x) => x.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.itemRow} testID={`fridge-item-${item.item_name}`}>
                <View style={styles.itemIcon}>
                  <Ionicons name="leaf-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.itemText}>{item.item_name}</Text>
                <TouchableOpacity
                  testID={`fridge-delete-${item.id}`}
                  onPress={() => removeItem(item.id)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="close" size={20} color={colors.mutedFg} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  addRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  chipsRow: { marginTop: spacing.md, height: 40 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  chipText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: "600" },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  emptyDesc: {
    fontSize: 14,
    color: colors.mutedFg,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 280,
  },
});
