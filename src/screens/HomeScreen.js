import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import Menu from "../components/Menu";
import { listTables } from "../services/tableService";

export default function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dữ liệu từ API
  const fetchTables = async () => {
    try {
      console.log("🔄 Fetching tables from API...");
      const response = await listTables({ active: true });
      
      console.log("✅ API Response:", JSON.stringify(response, null, 2));

      // Xử lý response - API trả về status: 200 hoặc "success"
      if (response.data && response.data.items) {
        const tableData = response.data.items;
        setTables(tableData);
        console.log(`📊 Loaded ${tableData.length} tables`);
      } else if (Array.isArray(response.data)) {
        // Trường hợp API trả về array trực tiếp
        setTables(response.data);
        console.log(`📊 Loaded ${response.data.length} tables`);
      } else {
        console.warn("⚠️ Unexpected response format:", response);
        setTables([]);
      }
    } catch (error) {
      console.error("❌ Error fetching tables:", error);
      Alert.alert(
        "Lỗi kết nối",
        "Không thể tải danh sách bàn. Vui lòng kiểm tra:\n" +
        "• Backend đang chạy tại http://192.168.0.100:3000\n" +
        "• MongoDB đã có dữ liệu\n" +
        "• Kết nối mạng ổn định",
        [
          { text: "Thử lại", onPress: () => fetchTables() },
          { text: "OK", style: "cancel" }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data khi component mount
  useEffect(() => {
    fetchTables();
  }, []);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTables();
  }, []);

  // Tính thời gian chơi nếu bàn đang playing
  const getPlayingTime = (table) => {
    if (table.status !== "playing" || !table.currentSession) {
      return null;
    }

    const startTime = new Date(table.currentSession.startAt);
    const now = new Date();
    const diffMs = now - startTime;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    return `${hours} giờ ${minutes} phút`;
  };

  // Render từng bàn
  const renderTable = (table) => {
    const isPlaying = table.status === "playing";
    const playingTime = getPlayingTime(table);
    const areaName = table.areaId?.name || "Chưa có khu vực";
    const areaColor = table.areaId?.color || "#0099ff";

    return (
      <View 
        key={table._id} 
        style={[
          styles.tableCard,
          { borderLeftColor: isPlaying ? "#00d68f" : areaColor }
        ]}
      >
        <View style={styles.tableHeader}>
          <View style={styles.tableIconContainer}>
            <Ionicons 
              name={isPlaying ? "play-circle" : "bookmark"} 
              size={24} 
              color={isPlaying ? "#00d68f" : areaColor} 
            />
          </View>
          <View style={styles.tableInfo}>
            <Text style={styles.tableStatus}>
              {areaName} • {isPlaying ? "Đang chơi" : "Trống"}
            </Text>
          </View>
          {isPlaying && (
            <View style={styles.playingBadge}>
              <Text style={styles.playingBadgeText}>PLAYING</Text>
            </View>
          )}
        </View>

        <View style={styles.tableBody}>
          <Text style={styles.tableName}>{table.name}</Text>
          
          <View style={styles.tableDetails}>
            {isPlaying && playingTime ? (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#00d68f" />
                <Text style={[styles.detailText, { color: "#00d68f", fontWeight: "600" }]}>
                  {playingTime}
                </Text>
              </View>
            ) : null}
            
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={16} color="#999" />
              <Text style={styles.detailText}>
                {table.ratePerHour?.toLocaleString("vi-VN")} đ/giờ
              </Text>
            </View>

            {table.code && (
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={16} color="#999" />
                <Text style={styles.detailText}>{table.code}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Nhóm bàn theo khu vực
  const groupTablesByArea = () => {
    const grouped = {};
    tables.forEach(table => {
      const areaName = table.areaId?.name || "Chưa phân khu";
      if (!grouped[areaName]) {
        grouped[areaName] = [];
      }
      grouped[areaName].push(table);
    });
    return grouped;
  };

  const handleAddTable = () => {
    navigation.navigate("OrderScreen");
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Header
          onMenuPress={() => setMenuVisible(true)}
          onNotificationPress={() => navigation.navigate("Notifications")}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0099ff" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  const groupedTables = groupTablesByArea();

  return (
    <View style={styles.container}>
      <Header
        onMenuPress={() => setMenuVisible(true)}
        onNotificationPress={() => navigation.navigate("Notifications")}
      />

      <Menu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
      />

      {/* Danh sách bàn theo khu vực */}
      <ScrollView 
        style={styles.tableList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {Object.keys(groupedTables).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có bàn nào</Text>
            <Text style={styles.emptySubText}>
              Vui lòng thêm dữ liệu vào MongoDB
            </Text>
          </View>
        ) : (
          Object.entries(groupedTables).map(([areaName, areaTables]) => (
            <View key={areaName} style={styles.areaSection}>
              <View style={styles.areaHeader}>
                <Text style={styles.areaTitle}>{areaName}</Text>
                <Text style={styles.areaCount}>({areaTables.length} bàn)</Text>
              </View>
              {areaTables.map(renderTable)}
            </View>
          ))
        )}
      </ScrollView>

      {/* Nút Tạo đơn */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
  },
  tableList: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  areaSection: {
    marginBottom: 20,
  },
  areaHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  areaTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  areaCount: {
    fontSize: 14,
    color: "#999",
    marginLeft: 8,
  },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
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
  playingBadge: {
    backgroundColor: "#00d68f",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  playingBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
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