import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "@/src/theme";

// This screen simply displays a loader; the AuthGate in _layout.tsx handles
// redirect to /login, /household, or /(tabs)/fridge based on auth state.
export default function Index() {
  return (
    <View style={styles.container} testID="root-index">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
