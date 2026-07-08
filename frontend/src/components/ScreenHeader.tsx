import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type HouseholdInfo = {
  id: string;
  name: string;
  invite_code: string;
  members: any[];
};

export function ScreenHeader({
  icon,
  title,
  subtitle,
  rightAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [hh, setHh] = useState<HouseholdInfo | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    (async () => {
      try {
        const r = await api.get<HouseholdInfo>("/household/me");
        setHh(r.data);
      } catch {}
    })();
  }, [showMenu]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={22} color={colors.primaryFg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightAction}
        <TouchableOpacity
          testID="header-profile-button"
          onPress={() => setShowMenu((v) => !v)}
          style={styles.avatar}
          activeOpacity={0.85}
        >
          <Text style={styles.avatarText}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {showMenu && (
        <View style={styles.menu} testID="header-profile-menu">
          <Text style={styles.menuName}>{user?.name}</Text>
          <Text style={styles.menuEmail}>{user?.email}</Text>
          {hh ? (
            <View style={styles.hhBox}>
              <Text style={styles.hhLabel}>HOUSEHOLD</Text>
              <Text style={styles.hhName}>{hh.name}</Text>
              <Text style={styles.hhLabel}>KODE UNDANGAN</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} testID="header-invite-code">
                  {hh.invite_code}
                </Text>
              </View>
              <Text style={styles.hhLabel}>ANGGOTA ({hh.members.length})</Text>
              {hh.members.map((m: any) => (
                <Text key={m.user_id} style={styles.memberText}>
                  • {m.name}
                </Text>
              ))}
            </View>
          ) : null}
          <TouchableOpacity
            testID="header-signout"
            style={styles.signOutBtn}
            onPress={() => {
              setShowMenu(false);
              signOut();
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            <Text style={styles.signOutText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedFg,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  menu: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuName: { fontSize: 15, fontWeight: "800", color: colors.text },
  menuEmail: { fontSize: 12, color: colors.mutedFg, marginTop: 2 },
  hhBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  hhLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.mutedFg,
    marginTop: 8,
  },
  hhName: { fontSize: 14, fontWeight: "700", color: colors.text },
  codeBox: {
    backgroundColor: colors.muted,
    padding: spacing.sm,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  codeText: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 4,
    color: colors.primary,
  },
  memberText: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  signOutBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: spacing.sm,
  },
  signOutText: { color: colors.destructive, fontWeight: "700" },
});
