import { useCallback, useEffect, useState } from "react";
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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { api } from "@/src/api/client";
import { colors, radius, spacing, shadows } from "@/src/theme";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { EmptyState } from "@/src/components/EmptyState";

type MealPlan = {
  id: string;
  household_id: string;
  date: string;
  meal_type: string;
  menu_name: string;
  ingredients: string[];
  is_archived: boolean;
  week_start: string;
};

type MasterRecipe = { menu_name: string; suggested_ingredients: string[] };

const MEAL_TYPES = ["Sarapan", "Makan Siang", "Makan Malam"];
const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const DAY_FULL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekMonday(date = new Date()): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function PlannerScreen() {
  const [monday] = useState<Date>(getWeekMonday());
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date();
    const dow = today.getDay();
    return dow === 0 ? 6 : dow - 1;
  });
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addMealType, setAddMealType] = useState<string>("Makan Siang");
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const weekStart = toISODate(monday);

  const load = useCallback(async () => {
    try {
      const r = await api.get<MealPlan[]>(`/meal-plans?week_start=${weekStart}`);
      setPlans(r.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(load, 5000);
      return () => clearInterval(id);
    }, [load])
  );

  const selectedDate = new Date(monday);
  selectedDate.setDate(monday.getDate() + selectedDay);
  const selectedDateISO = toISODate(selectedDate);
  const dayPlans = plans.filter((p) => p.date === selectedDateISO);

  const openAdd = (mealType: string) => {
    setAddMealType(mealType);
    setShowModal(true);
  };

  const handleSaved = (created: MealPlan) => {
    setPlans((prev) => [...prev, created]);
    setShowModal(false);
  };

  const removeMeal = async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.delete(`/meal-plans/${id}`);
    } catch {
      load();
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await api.post<{ added_count: number; skipped_in_fridge_count: number }>(
        "/grocery/generate"
      );
      setToast(
        `${r.data.added_count} bahan ditambahkan ke daftar belanja. ${r.data.skipped_in_fridge_count} sudah ada di kulkas.`
      );
      setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setToast(e?.message || "Gagal generate");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <ScreenHeader
        icon="calendar"
        title="Meal Planner"
        subtitle="Susun menu mingguan biar belanja tinggal generate."
      />

      <View style={styles.weekRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
        >
          {DAY_LABELS.map((label, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const isSelected = i === selectedDay;
            const hasMenu = plans.some((p) => p.date === toISODate(d));
            return (
              <TouchableOpacity
                key={label}
                testID={`day-chip-${i}`}
                style={[
                  styles.dayChip,
                  isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedDay(i)}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    isSelected && { color: colors.primaryFg },
                  ]}
                >
                  {label}
                </Text>
                <Text
                  style={[
                    styles.dayNum,
                    isSelected && { color: colors.primaryFg },
                  ]}
                >
                  {d.getDate()}
                </Text>
                {hasMenu ? (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: isSelected ? "#fff" : colors.accent },
                    ]}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          testID="planner-list"
        >
          <Text style={styles.dayHeading}>
            {DAY_FULL[selectedDay]}, {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
          </Text>

          {MEAL_TYPES.map((mt) => {
            const items = dayPlans.filter((p) => p.meal_type === mt);
            return (
              <View key={mt} style={styles.mealBlock}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealTypeIcon}>
                    <Ionicons
                      name={
                        mt === "Sarapan"
                          ? "sunny-outline"
                          : mt === "Makan Siang"
                          ? "restaurant-outline"
                          : "moon-outline"
                      }
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={styles.mealTypeText}>{mt}</Text>
                  <TouchableOpacity
                    testID={`planner-add-${mt}`}
                    style={styles.addMealBtn}
                    onPress={() => openAdd(mt)}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={styles.addMealText}>Tambah</Text>
                  </TouchableOpacity>
                </View>

                {items.length === 0 ? (
                  <Text style={styles.emptyMeal}>Belum ada menu untuk {mt.toLowerCase()}.</Text>
                ) : (
                  items.map((p) => (
                    <View key={p.id} style={styles.menuCard} testID={`meal-item-${p.id}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuName}>{p.menu_name}</Text>
                        {p.ingredients.length > 0 ? (
                          <View style={styles.ingRow}>
                            {p.ingredients.map((ing) => (
                              <View key={ing} style={styles.ingChip}>
                                <Text style={styles.ingChipText}>{ing}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.noIng}>Tidak ada bahan tercatat</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        testID={`meal-delete-${p.id}`}
                        onPress={() => removeMeal(p.id)}
                        style={styles.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            );
          })}

          {plans.length === 0 && (
            <EmptyState
              icon="calendar-outline"
              title="Minggu ini masih kosong"
              desc="Tambahkan menu untuk beberapa hari, lalu tekan Generate Daftar Belanja."
            />
          )}
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="generate-grocery-button"
          style={[styles.generateBtn, generating && { opacity: 0.7 }]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.9}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.generateText}>Generate Daftar Belanja</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {toast ? (
        <View style={styles.toast} testID="planner-toast">
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <AddMenuModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
        date={selectedDateISO}
        mealType={addMealType}
      />
    </SafeAreaView>
  );
}

// ---------------- Add Menu Modal ----------------
function AddMenuModal({
  visible,
  onClose,
  onSaved,
  date,
  mealType,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (p: MealPlan) => void;
  date: string;
  mealType: string;
}) {
  const [menuName, setMenuName] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [customIng, setCustomIng] = useState("");
  const [recipes, setRecipes] = useState<MasterRecipe[]>([]);
  const [saving, setSaving] = useState(false);
  const [matched, setMatched] = useState<MasterRecipe | null>(null);

  useEffect(() => {
    if (!visible) {
      setMenuName("");
      setIngredients([]);
      setCustomIng("");
      setRecipes([]);
      setMatched(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<MasterRecipe[]>(
          `/recipes/search?q=${encodeURIComponent(menuName)}`
        );
        setRecipes(r.data);
        const exact = r.data.find(
          (rc) => rc.menu_name.toLowerCase() === menuName.trim().toLowerCase()
        );
        if (exact) setMatched(exact);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [menuName, visible]);

  const pickRecipe = (rc: MasterRecipe) => {
    setMenuName(rc.menu_name);
    setMatched(rc);
    // Preselect all its ingredients
    setIngredients(rc.suggested_ingredients);
  };

  const toggleIng = (ing: string) => {
    setIngredients((prev) =>
      prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]
    );
  };

  const addCustom = () => {
    const v = customIng.trim();
    if (!v) return;
    if (!ingredients.includes(v)) setIngredients((p) => [...p, v]);
    setCustomIng("");
  };

  const handleSave = async () => {
    if (!menuName.trim()) return;
    setSaving(true);
    try {
      const r = await api.post<MealPlan>("/meal-plans", {
        date,
        meal_type: mealType,
        menu_name: menuName.trim(),
        ingredients,
      });
      onSaved(r.data);
    } catch {} finally {
      setSaving(false);
    }
  };

  const suggestedFromMatched = matched?.suggested_ingredients || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} testID="add-menu-modal">
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSub}>{mealType} · {date}</Text>
              <Text style={styles.modalTitle}>Tambah Menu</Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="add-menu-close">
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
              <Text style={styles.modalLabel}>Nama Menu</Text>
              <TextInput
                testID="add-menu-name"
                value={menuName}
                onChangeText={setMenuName}
                placeholder="Contoh: Sayur Asem"
                placeholderTextColor={colors.mutedFg}
                style={styles.modalInput}
              />

              {menuName.trim().length > 0 && recipes.length > 0 && (
                <View style={styles.recipeSuggestions}>
                  <Text style={styles.modalHint}>Menu populer:</Text>
                  <FlatList
                    data={recipes}
                    keyExtractor={(r) => r.menu_name}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        testID={`recipe-suggest-${item.menu_name}`}
                        style={[
                          styles.recipeChip,
                          matched?.menu_name === item.menu_name && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                        onPress={() => pickRecipe(item)}
                      >
                        <Text
                          style={[
                            styles.recipeChipText,
                            matched?.menu_name === item.menu_name && { color: "#fff" },
                          ]}
                        >
                          {item.menu_name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              {suggestedFromMatched.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, { marginTop: spacing.lg }]}>
                    Rekomendasi bahan
                  </Text>
                  <Text style={styles.modalHint}>Tap untuk pilih / batal. Kamu bisa custom di bawah.</Text>
                  <View style={styles.ingWrap}>
                    {suggestedFromMatched.map((ing) => {
                      const active = ingredients.includes(ing);
                      return (
                        <TouchableOpacity
                          key={ing}
                          testID={`ing-suggest-${ing}`}
                          onPress={() => toggleIng(ing)}
                          style={[styles.suggestChip, active && styles.suggestChipActive]}
                        >
                          {active ? (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          ) : (
                            <Ionicons name="add" size={14} color={colors.primary} />
                          )}
                          <Text
                            style={[
                              styles.suggestChipText,
                              active && { color: "#fff" },
                            ]}
                          >
                            {ing}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.modalLabel, { marginTop: spacing.lg }]}>Bahan custom</Text>
              <View style={styles.addRow}>
                <TextInput
                  testID="add-custom-ing"
                  value={customIng}
                  onChangeText={setCustomIng}
                  placeholder="Contoh: Kecap Manis"
                  placeholderTextColor={colors.mutedFg}
                  style={[styles.modalInput, { flex: 1 }]}
                  onSubmitEditing={addCustom}
                />
                <TouchableOpacity
                  testID="add-custom-ing-btn"
                  onPress={addCustom}
                  style={styles.addSmallBtn}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {ingredients.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, { marginTop: spacing.lg }]}>
                    Bahan terpilih ({ingredients.length})
                  </Text>
                  <View style={styles.ingWrap}>
                    {ingredients.map((ing) => (
                      <View key={ing} style={styles.selectedChip}>
                        <Text style={styles.selectedChipText}>{ing}</Text>
                        <TouchableOpacity onPress={() => toggleIng(ing)}>
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                testID="add-menu-save"
                style={[styles.primaryBtn, (saving || !menuName.trim()) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving || !menuName.trim()}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Simpan Menu</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  weekRow: { paddingTop: spacing.sm, paddingBottom: spacing.sm, height: 84 },
  dayChip: {
    width: 56,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayLabel: { fontSize: 11, fontWeight: "700", color: colors.mutedFg, letterSpacing: 0.5 },
  dayNum: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
  dayHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  mealBlock: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mealTypeIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  mealTypeText: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.text },
  addMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  addMealText: { fontSize: 13, color: colors.primary, fontWeight: "700" },
  emptyMeal: { fontSize: 13, color: colors.mutedFg, fontStyle: "italic" },
  menuCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  menuName: { fontSize: 16, fontWeight: "800", color: colors.text },
  ingRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  ingChip: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ingChipText: { fontSize: 11, color: colors.textSoft, fontWeight: "600" },
  noIng: { fontSize: 12, color: colors.mutedFg, marginTop: 4, fontStyle: "italic" },
  trashBtn: { padding: 8 },
  bottomBar: {
    position: "absolute",
    bottom: 20,
    left: spacing.lg,
    right: spacing.lg,
  },
  generateBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.strong,
  },
  generateText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
    ...shadows.strong,
  },
  toastText: { color: "#fff", flex: 1, fontWeight: "600", fontSize: 13 },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    padding: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 32 : spacing.lg,
    minHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  modalSub: { fontSize: 12, color: colors.mutedFg, fontWeight: "700" },
  modalTitle: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  modalLabel: { fontSize: 13, color: colors.mutedFg, fontWeight: "700", marginBottom: 6 },
  modalHint: { fontSize: 12, color: colors.mutedFg, marginBottom: 8 },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeSuggestions: { marginTop: spacing.sm },
  recipeChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    flexShrink: 0,
  },
  recipeChipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  ingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  suggestChipText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  addRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  addSmallBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  selectedChipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
