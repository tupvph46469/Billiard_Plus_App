
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import Header from "../components/Header";
import Menu from "../components/Menu";

import { sessionService } from "../services/sessionService";
import { tableService } from "../services/tableService";
import { listAreas } from "../services/areaService";

/* ===================== HELPER ===================== */
const getId = (val) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  if (typeof val === "number") return String(val);

  if (typeof val === "object") {
    if (val.$oid) return val.$oid;
    if (val._id?.$oid) return val._id.$oid;
    if (typeof val._id === "string") return val._id;
  }

  const str = String(val);
  return str !== "undefined" && str !== "null" && str !== "" ? str : undefined;
};

/* ===================== SCREEN ===================== */
export default function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  /* ===== LOAD USER ===== */
 useFocusEffect(
  React.useCallback(() => {
    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          setUser(JSON.parse(userStr));
        }
      } catch (e) {
        console.log("❌ Load user error:", e);
      }
    };

    loadUser();
  }, [])
);


  /* ===== LOAD DATA ===== */
  useEffect(() => {
    loadData();
  }, []);

  /* ===== REALTIME CLOCK ===== */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // ---------- AREAS ----------
      const areaRes = await listAreas();
      const rawAreas = areaRes.data?.data || areaRes.data || areaRes;

      const normAreas = (Array.isArray(rawAreas) ? rawAreas : [])
        .map((a, i) => ({
          ...a,
          _id: getId(a._id) || `area-${i}`,
        }))
        .filter((a) => a._id);

      setAreas(normAreas);

      // ---------- TABLES ----------
      const tableRes = await tableService.list();
      const rawTables =
        tableRes.data?.items ||
        tableRes.data?.data ||
        tableRes.data ||
        tableRes;

      const normTables = (Array.isArray(rawTables) ? rawTables : [])
        .map((t, i) => ({
          ...t,
          _id: getId(t._id) || `table-${i}`,
          areaId: getId(t.areaId) || getId(t.area),
        }))
        .filter((t) => t._id);

      setTables(normTables);

      // ---------- SESSIONS ----------
      const sessionRes = await sessionService.list();
      const rawSessions =
        sessionRes.data?.items ||
        sessionRes.data?.data ||
        sessionRes.data ||
        sessionRes;

      const normSessions = (Array.isArray(rawSessions) ? rawSessions : []).map(
        (s, i) => ({
          ...s,
          _id: getId(s._id) || `session-${i}`,
          tableId: getId(s.tableId) || getId(s.table),
        })
      );

      const playing = normSessions.filter(
        (s) => (!s.endTime || s.status === "playing") && s.tableId
      );

      setSessions(playing);
    } catch (err) {
      console.log("❌ Load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getAreaName = (id) =>
    areas.find((a) => a._id === id)?.name || "Chưa rõ khu vực";

  const getAreaColor = (id) =>
    areas.find((a) => a._id === id)?.color || "#999";

  const calculateSessionInfo = (tableId) => {
    const s = sessions.find((x) => x.tableId === tableId);
    if (!s?.startTime) return null;

    const diff = currentTime - new Date(s.startTime);
    const totalMinutes = Math.max(0, Math.floor(diff / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const table = tables.find((t) => t._id === tableId) || {};
    const money = Math.ceil((totalMinutes / 60) * (table.ratePerHour || 0));

    return {
      session: s,
      formatted: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      money,
    };
  };

  const formatMoney = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v);

  const playingTables = tables.filter(
    (t) =>
      t.status === "playing" &&
      sessions.some((s) => s.tableId === t._id)
  );

  const renderPlayingTable = (table, index) => {
    const info = calculateSessionInfo(table._id);
    if (!info) return null;

    return (
      <TouchableOpacity
        key={table._id || index}
        style={[styles.tableCard, { borderLeftColor: getAreaColor(table.areaId) }]}
        onPress={() =>
          navigation.navigate("OrderDetail", {
            sessionId: info.session._id,
            tableName: table.name,
            tableId: table._id,
            ratePerHour: table.ratePerHour || 40000,
          })
        }
      >
        <View style={styles.tableHeader}>
          <View>
            <Text style={styles.areaLabel}>{getAreaName(table.areaId)}</Text>
            <Text style={styles.tableName}>{table.name}</Text>
          </View>

          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Đang chơi</Text>
          </View>
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} />
            <Text style={styles.infoText}>{info.formatted}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={18} />
            <Text style={styles.infoText}>{formatMoney(info.money)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00d68f" />
        <Text>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onMenuPress={() => setMenuVisible(true)} />

      {/* 🔥 MENU NHẬN USER */}
      <Menu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
        user={user}
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {playingTables.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="grid-outline" size={72} color="#cbd5e1" />
             <Text style={styles.emptyTitle}>
      Chưa có bàn đang chơi
    </Text>
    <Text style={styles.emptySubtitle}>
      Hiện tại chưa có bàn nào được mở
    </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {playingTables.map(renderPlayingTable)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("OrderScreen")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/* ===================== STYLE ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContainer: { padding: 16, paddingBottom: 100 },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  areaLabel: { fontSize: 12, color: "#999" },
  tableName: { fontSize: 20, fontWeight: "700" },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f8f3",
    padding: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00d68f",
    marginRight: 6,
  },
  statusText: { color: "#00d68f", fontWeight: "600" },

  sessionInfo: { marginTop: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  infoText: { marginLeft: 8, fontSize: 16 },

  addButton: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#00d68f",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
  flex: 1,
  minHeight: 700, // đảm bảo đủ cao khi ScrollView
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: 40,
},

emptyTitle: {
  marginTop: 16,
  fontSize: 18,
  fontWeight: "600",
  color: "#334155",
},

emptySubtitle: {
  marginTop: 6,
  fontSize: 16,
  color: "#94a3b8",
},

});