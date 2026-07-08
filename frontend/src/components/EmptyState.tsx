import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/src/theme";

export function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={40} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
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
