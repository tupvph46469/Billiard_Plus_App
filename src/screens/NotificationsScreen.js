import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Ionicons
        name="notifications-outline"
        size={72}
        color="#cbd5e1"
      />

      <Text style={styles.title}>
        Thông báo
      </Text>

      <Text style={styles.subtitle}>
        Chức năng thông báo đang được phát triển.
      </Text>

      <Text style={styles.note}>
        Các thông báo về bàn chơi, hóa đơn và hệ thống
        sẽ được hiển thị tại đây trong thời gian tới.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#ffffff",
  },

  title: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },

  note: {
    marginTop: 12,
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
});
