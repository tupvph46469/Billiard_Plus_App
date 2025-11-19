import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { getBills } from "../services/billService";

const QLHoaDonScreen = ({ navigation }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const data = await getBills();

      console.log("📌 API trả về:", data);

      // Kiểm tra dữ liệu trả về là mảng
      if (Array.isArray(data)) {
        setBills(data);
      } else {
        console.log("⚠ API không trả về mảng bills");
        setBills([]);
      }
    } catch (error) {
      console.log("❌ Lỗi tải hóa đơn:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("InvoiceDetail", { billId: item.id || item._id })}
    >
      <Text style={styles.title}>Mã HD: {item.code || "---"}</Text>
      <Text>
        Bàn: {item.table?.name || item.tableName || "Không rõ"}
      </Text>
      <Text>
        Ngày:{" "}
        {item.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : "Không rõ"}
      </Text>
      <Text style={styles.total}>
        Tổng tiền:{" "}
        {item.total ? item.total.toLocaleString() : 0}
        đ
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {bills.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text>Không có hóa đơn nào.</Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => String(item.id || item._id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
};

export default QLHoaDonScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 3,
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
  },
  total: {
    color: "#d9534f",
    fontWeight: "bold",
    marginTop: 5,
  },
});