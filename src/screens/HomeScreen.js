// HomeScreen.js - Chỉ hiển thị bàn đang chơi với khu vực nhúng trong card

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Header from "../components/Header";
import Menu from "../components/Menu";

import { sessionService } from "../services/sessionService";
import { tableService } from "../services/tableService";
import { listAreas } from "../services/areaService";

// Improved ID extraction with better error handling
const getId = (val) => {
  // Null/undefined check
  if (val === null || val === undefined) return undefined;

  // Already a string
  if (typeof val === "string" && val.trim() !== "") return val.trim();

  // Number (rare but possible)
  if (typeof val === "number") return String(val);

  // Object with MongoDB $oid format
  if (typeof val === "object") {
    // Direct $oid property
    if (val.$oid && typeof val.$oid === "string") return val.$oid;

    // Nested _id.$oid
    if (val._id && typeof val._id === "object" && val._id.$oid) {
      return val._id.$oid;
    }

    // _id as string
    if (val._id && typeof val._id === "string") return val._id;
  }

  // Last resort: convert to string if not empty
  const str = String(val);
  return str !== "undefined" && str !== "null" && str !== "" ? str : undefined;
};

export default function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  // Real-time clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // ==================== LOAD AREAS ====================
      const areaRes = await listAreas();
      const rawAreas = areaRes.data?.data || areaRes.data || areaRes;

      console.log("📊 Raw areas sample:", rawAreas?.[0]);

      const normAreas = (Array.isArray(rawAreas) ? rawAreas : [])
        .map((a, index) => {
          const id = getId(a._id) || getId(a.id) || `area-fallback-${index}`;
          return {
            ...a,
            _id: id,
            originalId: a._id,
          };
        })
        .filter((a) => a._id && !a._id.startsWith("area-fallback"));

      console.log(`✅ Normalized ${normAreas.length} areas`);
      setAreas(normAreas);

      // ==================== LOAD TABLES ====================
      const tableRes = await tableService.list();
      const rawTables =
        tableRes.data?.items ||
        tableRes.data?.data ||
        tableRes.data ||
        tableRes;

      console.log("📊 Raw tables sample:", rawTables?.[0]);

      const normTables = (Array.isArray(rawTables) ? rawTables : [])
        .map((t, index) => {
          const id = getId(t._id) || getId(t.id) || `table-fallback-${index}`;
          const areaId = getId(t.areaId) || getId(t.area) || getId(t.area_id);

          return {
            ...t,
            _id: id,
            areaId: areaId,
            originalId: t._id,
            originalAreaId: t.areaId,
          };
        })
        .filter((t) => t._id && !t._id.startsWith("table-fallback"));

      console.log(`✅ Normalized ${normTables.length} tables`);
      setTables(normTables);

      // ==================== LOAD SESSIONS ====================
      const sessionRes = await sessionService.list();
      const rawSessions =
        sessionRes.data?.items ||
        sessionRes.data?.data ||
        sessionRes.data ||
        sessionRes;

      console.log("📊 Raw sessions sample:", rawSessions?.[0]);

      const normSessions = (Array.isArray(rawSessions) ? rawSessions : []).map(
        (s, index) => {
          const id =
            getId(s._id) || getId(s.id) || `session-${Date.now()}-${index}`;
          const tableId =
            getId(s.tableId) || getId(s.table_id) || getId(s.table);

          return {
            ...s,
            _id: id,
            tableId: tableId,
            originalId: s._id,
            originalTableId: s.tableId,
          };
        }
      );

      // Filter only active sessions
      const playingOnly = normSessions.filter((s) => {
        const isActive = !s.endTime || s.status === "playing";
        const hasValidTableId = !!s.tableId;
        return isActive && hasValidTableId;
      });

      console.log(`✅ Normalized ${playingOnly.length} active sessions`);
      setSessions(playingOnly);
    } catch (err) {
      console.error("❌ Load error:", err);
      console.error("Error details:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getAreaName = (areaId) => {
    if (!areaId) return "Chưa có khu vực";
    const area = areas.find((a) => a._id === areaId);
    return area?.name || "Chưa rõ khu vực";
  };

  const getAreaColor = (areaId) => {
    if (!areaId) return "#999";
    const area = areas.find((a) => a._id === areaId);
    return area?.color || "#999";
  };

  const calculateSessionInfo = (tableId) => {
    if (!tableId) return null;

    const session = sessions.find((s) => s.tableId === tableId);
    if (!session || !session.startTime) return null;

    const start = new Date(session.startTime);
    const now = currentTime; // Use real-time clock
    const diffMs = now - start;
    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formatted = `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}`;

    const table = tables.find((t) => t._id === tableId) || {};
    const rate = table.ratePerHour || 0;
    const money = Math.ceil((totalMinutes / 60) * rate);

    return { formatted, money, session };
  };

  const formatMoney = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v);

  // Lấy danh sách bàn đang chơi
  const getPlayingTables = () => {
    return tables.filter((table) => {
      const hasSession = sessions.some((s) => s.tableId === table._id);
      return hasSession && table.status === "playing";
    });
  };


const renderPlayingTable = (table, index) => {
  if (!table || !table._id) return null;

  const info = calculateSessionInfo(table._id);
  if (!info) return null;

  const areaName = getAreaName(table.areaId);
  const areaColor = getAreaColor(table.areaId);
  const key = table._id || `table-${table.name}-${index}`;

  return (
    <TouchableOpacity
      key={key}
      style={[styles.tableCard, { borderLeftColor: areaColor }]}
      onPress={() => {
        // ✅ FIX: Truyền đúng params mà OrderDetail expect
        navigation.navigate("OrderDetail", {
          sessionId: info.session._id || info.session.id,
          tableName: table.name,
          tableId: table._id,
          ratePerHour: table.ratePerHour || 40000,
        });
      }}
    >
      {/* Header với khu vực */}
      <View style={styles.tableHeader}>
        <View style={styles.tableNameSection}>
          <Text style={styles.areaLabel} numberOfLines={1}>
            {areaName}
          </Text>
          <Text style={styles.tableName}>{table.name || "Bàn"}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: "#e8f8f3" }]}>
          <View style={[styles.statusDot, { backgroundColor: "#00d68f" }]} />
          <Text style={[styles.statusText, { color: "#00d68f" }]}>
            Đang chơi
          </Text>
        </View>
      </View>

      {/* Thông tin session */}
      <View style={styles.sessionInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{info.formatted}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{formatMoney(info.money)}</Text>
        </View>
      </View>

      {/* Footer - Tiền theo giờ */}
      <View style={styles.footer}>
        <Ionicons name="timer-outline" size={14} color="#999" />
        <Text style={styles.footerText}>Tiền theo giờ</Text>
      </View>
    </TouchableOpacity>
  );
};

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00d68f" />
        <Text style={{ marginTop: 10, color: "#666" }}>
          Đang tải dữ liệu...
        </Text>
      </View>
    );
  }

  const playingTables = getPlayingTables();

  return (
    <View style={styles.container}>
      <Header onMenuPress={() => setMenuVisible(true)} />
      <Menu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {playingTables.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="beer-outline" size={64} color="#ddd" />
            <Text style={styles.emptyText}>Chưa có bàn nào đang chơi</Text>
            <Text style={styles.emptySubText}>
              Nhấn nút "Tạo đơn" để bắt đầu
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {playingTables.map((table, index) =>
              renderPlayingTable(table, index)
            )}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("OrderScreen")}
      >
        <Ionicons name="add" size={28} color="#fff" />
        {/* <Text style={styles.addButtonText}>Tạo đơn</Text> */}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollView: {
    flex: 1,
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyText: {
    fontSize: 18,
    color: "#999",
    fontWeight: "600",
    marginTop: 16,
  },

  emptySubText: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 8,
  },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  tableNameSection: {
    flex: 1,
    marginRight: 12,
  },

  areaLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  tableName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  sessionInfo: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  infoText: {
    marginLeft: 8,
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  footerText: {
    fontSize: 13,
    color: "#999",
    marginLeft: 6,
  },

  addButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#00d68f",
    width: 60,
    height: 60,
    borderRadius: 30, 
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#00d68f",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 6,
  },
});
