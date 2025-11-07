//Trang Chu

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const [tables, setTables] = useState([
    { id: 3, name: "Bàn 3", status: "Khu vực khách", time: "3 giờ 45 phút" },
    { id: 1, name: "Bàn 1", status: "Khu vực khách", time: "3 giờ 3 phút" },
    { id: 5, name: "Bàn 5", status: "Khu vực khách", time: "2 giờ 56 phút" },
    { id: 7, name: "Bàn 7", status: "Khu vực khách", time: "2 giờ 17 phút" },
    { id: 12, name: "Bàn 12", status: "Khu vực khách", time: "1 giờ 8 phút" },
  ]);

  const handleAddTable = () => {
    Alert.alert(
      "Thêm bàn mới",
      "Chức năng thêm bàn đang được phát triển",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu" size={28} color="#333" />
        </TouchableOpacity>
        <Image
          source={require("../../assets/logo.jpg")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.notificationIcon}>
          <Ionicons name="notifications" size={28} color="#333" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>2</Text>
          </View>
        </View>
      </View>

      {/* Danh sách bàn */}
      <ScrollView style={styles.tableList}>
        {tables.map((table) => (
          <View key={table.id} style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <View style={styles.tableIconContainer}>
                <Ionicons name="bookmark" size={24} color="#0099ff" />
              </View>
              <View style={styles.tableInfo}>
                <Text style={styles.tableStatus}>{table.status}</Text>
              </View>
            </View>
            <View style={styles.tableBody}>
              <Text style={styles.tableName}>{table.name}</Text>
              <View style={styles.tableDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#999" />
                  <Text style={styles.detailText}>{table.time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={16} color="#999" />
                  <Text style={styles.detailText}>Tính theo giờ</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Nút Tạo đơn (floating button) */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddTable}>
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={styles.addButtonText}>Tạo đơn</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerLogo: {
    width: 50,
    height: 50,
  },
  notificationIcon: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    right: -5,
    top: -5,
    backgroundColor: "#ff4444",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  tableList: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#0099ff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableIconContainer: {
    marginRight: 10,
  },
  tableInfo: {
    flex: 1,
  },
  tableStatus: {
    fontSize: 14,
    color: "#666",
  },
  tableBody: {
    padding: 12,
  },
  tableName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  tableDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#999",
  },
  addButton: {
    position: "absolute",
    bottom: 80,
    right: 20,
    backgroundColor: "#00d68f",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
  },
});