import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Keyboard,
  RefreshControl,
} from "react-native";
import { getBills } from "../services/billService";
import { Ionicons } from "@expo/vector-icons";

const tabs = [
  { label: "Tất cả", value: "all", icon: "list" },
  { label: "Đã thanh toán", value: "paid", icon: "checkmark-circle" },
  { label: "Chưa TT", value: "unpaid", icon: "time" },
];

const QLHoaDonScreen = ({ navigation }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const data = await getBills();
      console.log("📌 API trả về:", data);

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBills();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Không rõ";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  };

  const getPaymentIcon = (paymentMethod) => {
    const method = String(paymentMethod).toLowerCase();
    if (method === 'cash') return 'cash';
    if (method === 'momo') return 'card';
    return 'wallet';
  };

  const renderItem = ({ item }) => {
    const id = item.id || item._id;
    const paymentMethod = item.paymentMethod || "không rõ";
    const tableName = item.table?.name || item.tableName || "Không rõ";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("InvoiceDetail", { billId: id })}
        activeOpacity={0.7}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.codeContainer}>
              <Ionicons name="receipt" size={16} color="#007AFF" />
              <Text style={styles.codeText} numberOfLines={1}>
                {item.code || id}
              </Text>
            </View>
            <View style={styles.tableContainer}>
              <Ionicons name="square-outline" size={14} color="#666" />
              <Text style={styles.tableText} numberOfLines={1}>
                {tableName}
              </Text>
            </View>
          </View>
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, item.paid ? styles.statusPaid : styles.statusUnpaid]}>
            <Ionicons 
              name={item.paid ? "checkmark-circle" : "time"} 
              size={14} 
              color="#fff" 
            />
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#999" />
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentRow}>
          <View style={styles.paymentMethod}>
            <Ionicons name={getPaymentIcon(paymentMethod)} size={16} color="#666" />
            <Text style={styles.paymentMethodText}>
              {String(paymentMethod).toUpperCase()}
            </Text>
          </View>
          
          {item.paid && item.paidAt && (
            <Text style={styles.paidTime}>
              {formatDate(item.paidAt)}
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Total Amount */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng tiền</Text>
          <Text style={styles.totalValue} numberOfLines={1}>
            {item.total ? item.total.toLocaleString("vi-VN") : 0}đ
          </Text>
        </View>

        {/* Chevron */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  const filteredBills = bills.filter((bill) => {
    const text = searchText.trim().toLowerCase();
    const billCode = (bill.code || bill.id || bill._id || "").toString().toLowerCase();
    const tableName = (bill.table?.name || bill.tableName || "").toLowerCase();
    const paymentMethod = (bill.paymentMethod || "").toLowerCase();
    const total = (bill.total || 0).toString();
    
    const matchSearch = text === "" || 
                       tableName.includes(text) || 
                       billCode.includes(text) ||
                       paymentMethod.includes(text) ||
                       total.includes(text);

    let matchTab = true;
    if (activeTab === "paid") matchTab = bill.paid === true;
    if (activeTab === "unpaid") matchTab = bill.paid === false;

    return matchSearch && matchTab;
  });

  // Thống kê
  const stats = {
    total: bills.length,
    paid: bills.filter(b => b.paid).length,
    unpaid: bills.filter(b => !b.paid).length,
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={26} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Quản lý hóa đơn</Text>

        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="filter-outline" size={26} color="#333" />
        </TouchableOpacity>
      </View>

      {/* STATS SUMMARY */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Tổng số</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#28a745' }]}>{stats.paid}</Text>
          <Text style={styles.statLabel}>Đã thanh toán</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#ff3b30' }]}>{stats.unpaid}</Text>
          <Text style={styles.statLabel}>Chưa thanh toán</Text>
        </View>
      </View>

      {/* SEARCH BOX */}
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchBox,
          isSearchFocused && styles.searchBoxFocused
        ]}>
          <Ionicons name="search" size={20} color={isSearchFocused ? "#007AFF" : "#999"} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo mã, bàn, phương thức..."
            value={searchText}
            onChangeText={(text) => setSearchText(text)}
            placeholderTextColor="#999"
            returnKeyType="search"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchText.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                setSearchText("");
                Keyboard.dismiss();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TAB FILTER */}
      <View style={styles.tabContainer}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setActiveTab(t.value)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              activeTab === t.value && styles.activeTab
            ]}
          >
            <Ionicons 
              name={t.icon} 
              size={16} 
              color={activeTab === t.value ? '#fff' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === t.value && styles.activeTabText
              ]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LIST */}
      {filteredBills.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons 
            name={searchText ? "search-outline" : "receipt-outline"} 
            size={64} 
            color="#ccc" 
          />
          <Text style={styles.emptyText}>
            {searchText ? "Không tìm thấy kết quả" : "Không có hóa đơn nào"}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchText 
              ? `Không tìm thấy hóa đơn với từ khóa "${searchText}"`
              : activeTab === 'paid' 
                ? 'Chưa có hóa đơn đã thanh toán'
                : activeTab === 'unpaid'
                  ? 'Chưa có hóa đơn chưa thanh toán'
                  : 'Danh sách hóa đơn trống'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={(item) => String(item.id || item._id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />
      )}
    </View>
  );
};

export default QLHoaDonScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // LOADING
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 16,
  },

  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },

  // STATS SUMMARY
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: '#666',
  },

  statDivider: {
    width: 1,
    backgroundColor: '#e5e5e5',
    marginHorizontal: 8,
  },

  // SEARCH
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  searchBoxFocused: {
    borderColor: '#007AFF',
    shadowOpacity: 0.1,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    marginLeft: 8,
    paddingVertical: 0,
  },

  // TABS
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    marginHorizontal: 4,
    minHeight: 38,
  },

  activeTab: {
    backgroundColor: "#007AFF",
    borderColor: '#007AFF',
  },

  tabText: {
    fontSize: 12,
    color: "#666",
    fontWeight: '500',
    marginLeft: 4,
    flexShrink: 1,
    textAlign: 'center',
  },

  activeTabText: {
    color: "#fff",
    fontWeight: "600",
  },

  // LIST
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80,
  },

  // CARD
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },

  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 6,
    flex: 1,
  },

  tableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tableText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },

  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  statusPaid: {
    backgroundColor: '#28a745',
  },

  statusUnpaid: {
    backgroundColor: '#ff3b30',
  },

  // DATE & PAYMENT
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  dateText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },

  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },

  paidTime: {
    fontSize: 11,
    color: '#28a745',
    fontWeight: '500',
  },

  // DIVIDER
  cardDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 12,
  },

  // TOTAL
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
    flexShrink: 1,
  },

  // CHEVRON
  chevronContainer: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },

  // EMPTY STATE
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },

  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#999',
    fontWeight: "600",
    textAlign: "center",
  },

  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#ccc",
    textAlign: "center",
  },
});