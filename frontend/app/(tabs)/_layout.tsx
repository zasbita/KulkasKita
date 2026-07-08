import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={focused ? 26 : 24} color={focused ? colors.accent : colors.mutedFg} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedFg,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
      }}
    >
      <Tabs.Screen
        name="fridge"
        options={{
          title: "Kulkas",
          tabBarIcon: ({ focused }) => <TabIcon name="snow" focused={focused} />,
          tabBarButtonTestID: "tab-fridge",
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Menu",
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
          tabBarButtonTestID: "tab-planner",
        }}
      />
      <Tabs.Screen
        name="grocery"
        options={{
          title: "Belanja",
          tabBarIcon: ({ focused }) => <TabIcon name="basket" focused={focused} />,
          tabBarButtonTestID: "tab-grocery",
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Riwayat",
          tabBarIcon: ({ focused }) => <TabIcon name="time" focused={focused} />,
          tabBarButtonTestID: "tab-history",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
