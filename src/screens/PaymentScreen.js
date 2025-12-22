import React, { useState, useEffect } from "react";
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
import { Ionicons } from '@expo/vector-icons';
import Header from "../components/Header";
import Menu from "../components/Menu";
import api from '../services/api';

export default function PaymentScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // pending, confirmed
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bills, setBills] = useState([]);

  useEffect(() => {
    // Chỉ load bills khi ở tab "Chờ thanh toán"
    if (activeTab === 'pending') {
      loadBills();
    }
  }, [activeTab]);

  // Fetch bills từ API - chỉ cho tab "Chờ thanh toán"
  const loadBills = async () => {
    try {
      setLoading(true);
      
      // Chỉ lấy bills chưa thanh toán
      const params = {
        paid: false,
        sort: '-createdAt',
        limit: 50
      };
      
      // Gọi API GET /bills
      const response = await api.get('/bills', { params });
      
      // Extract bills từ response
      let billsData = [];
      if (response.data?.data?.items && Array.isArray(response.data.data.items)) {
        billsData = response.data.data.items;
      }
      
      // Process và normalize data
      const processedBills = billsData.map((bill, index) => ({
        id: bill.id || bill._id || `bill-${index}`,
        code: bill.code || 'N/A',
        tableName: bill.tableName || bill.table?.name || `Bàn ${index + 1}`,
        areaName: bill.areaName || bill.area?.name || 'KHU VỰC 1',
        areaColor: "#00d68f",
        total: Number(bill.total || 0),
        subTotal: Number(bill.subTotal || 0),
        playAmount: Number(bill.playAmount || 0),
        serviceAmount: Number(bill.serviceAmount || 0),
        createdAt: bill.createdAt || new Date().toISOString(),
        paid: Boolean(bill.paid),
        paymentMethod: bill.paymentMethod || 'cash',
        status: Boolean(bill.paid) ? 'paid' : 'pending',
        originalBill: bill
      }));
      
      console.log(`✅ Fetched ${processedBills.length} bills successfully`);
      setBills(processedBills);
      
    } catch (error) {
      let errorMessage = 'Không thể tải danh sách hóa đơn';
      if (error.response?.status === 401) {
        errorMessage = 'Phiên đăng nhập hết hạn';
      } else if (error.response?.status === 403) {
        errorMessage = 'Không có quyền xem hóa đơn';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Lỗi', errorMessage);
      setBills([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    // Chỉ refresh khi ở tab "Chờ thanh toán"
    if (activeTab === 'pending') {
      setRefreshing(true);
      loadBills();
    }
  };

  const formatMoney = (amount) => 
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

// PATCH cho PaymentScreen.js

const handlePayment = async (bill) => {
  try {
    console.log('💳 Processing payment for bill:', bill.id);
    
    // ✅ Extract items từ bill
    let billItems = [];
    if (bill.originalBill?.items && Array.isArray(bill.originalBill.items)) {
      billItems = bill.originalBill.items;
    }
    
    console.log('📦 Bill items found:', billItems.length, billItems);
    
    // Chuyển đến ThanhToanScreen với thông tin bill
    navigation.navigate('ThanhToan', { 
      // Thông tin từ bill
      billId: bill.id,
      billData: bill.originalBill,
      
      // Thông tin cần thiết cho ThanhToanScreen
      sessionId: bill.originalBill?.session?.id || bill.originalBill?.sessionId,
      tableName: bill.tableName,
      tableId: bill.originalBill?.table?.id || bill.originalBill?.tableId,
      totalAmount: bill.total,
      
      // ⭐ CRITICAL: Truyền items
      items: billItems,
      
      // Thông tin bổ sung
      playAmount: bill.playAmount,
      serviceAmount: bill.serviceAmount,
      subTotal: bill.subTotal,
      paymentMethod: bill.paymentMethod,
      billCode: bill.code,
      
      // Thời gian
      startTime: bill.originalBill?.startTime,
      endTime: bill.originalBill?.endTime,
      
      // Flag để biết đây là thanh toán bill có sẵn
      isExistingBill: true
    });
    
  } catch (error) {
    console.error('❌ Error navigating to payment:', error);
    Alert.alert('Lỗi', 'Không thể mở màn hình thanh toán');
  }
};
  const renderBillCard = (bill, index) => {
    return (
      <View
        key={bill.id || index}
        style={[styles.billCard, { borderLeftColor: bill.areaColor }]}
      >
        {/* Header với khu vực */}
        <View style={styles.billHeader}>
          <View style={styles.billNameSection}>
            <Text style={styles.areaLabel} numberOfLines={1}>
              {bill.areaName}
            </Text>
            <Text style={styles.billTitle}>{bill.tableName}</Text>
          </View>

          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Chờ thanh toán</Text>
          </View>
        </View>

        {/* Thông tin hóa đơn */}
        <View style={styles.billInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{formatTime(bill.createdAt)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="receipt-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{formatMoney(bill.total)}</Text>
          </View>
        </View>

        {/* Payment Method & Action */}
        <View style={styles.billFooter}>
          <View style={styles.paymentMethodContainer}>
            <Ionicons name="cash-outline" size={16} color="#666" />
            <Text style={styles.paymentMethodText}>
              {bill.paymentMethod === 'cash' ? 'Tiền mặt' : 'Thẻ'}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.paymentButton}
            onPress={() => handlePayment(bill)}
          >
            <Ionicons name="card-outline" size={16} color="#fff" />
            <Text style={styles.paymentButtonText}>Thanh toán</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name="receipt-outline" 
        size={120} 
        color="#666" 
        style={{opacity: 0.5}}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'pending' 
          ? 'Chưa có hóa đơn nào chờ thanh toán'
          : 'Danh sách hóa đơn chờ xác nhận trống'
        }
      </Text>
      {activeTab === 'pending' && (
        <Text style={styles.emptySubTitle}>
          Tạo đơn từ bàn để có hóa đơn thanh toán
        </Text>
      )}
    </View>
  );

  const renderContent = () => {
    // Tab "Chờ xác nhận" - chỉ hiển thị empty state
    if (activeTab === 'confirmed') {
      return renderEmptyState();
    }

    // Tab "Chờ thanh toán" - hiển thị loading và danh sách bills
    if (loading && !refreshing) {
      return (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ marginTop: 10, color: "#666" }}>Đang tải hóa đơn...</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {bills.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.listContainer}>
            {bills.map((bill, index) => renderBillCard(bill, index))}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        onMenuPress={() => setMenuVisible(true)}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />
      
      <Menu 
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
      />
{/* Tab Navigation (centered primary tab with badge) */}
<View style={styles.tabContainer}>
  <TouchableOpacity
    style={[styles.centeredTab, activeTab === 'pending' && styles.centeredTabActive]}
    onPress={() => setActiveTab('pending')}
    activeOpacity={0.8}
  >
    <Text style={[styles.centeredTabText, activeTab === 'pending' && styles.centeredTabTextActive]}>
      Chờ thanh toán
    </Text>

    {/* Badge hiển thị số bills (nằm ở cùng hàng, cách một khoảng) */}
    <View style={styles.tabBadge}>
      <Text style={styles.tabBadgeText}>{bills.length}</Text>
    </View>
  </TouchableOpacity>
</View>


      {/* Content */}
      {renderContent()}
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
    alignItems: "center" 
  },

  /* Tab - centered style */
tabContainer: {
  flexDirection: 'row',
  justifyContent: 'center',   // quan trọng: căn giữa khu vực tab
  backgroundColor: '#fff',
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#e9eef2',
  alignItems: 'center',
},

centeredTab: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 18,
  paddingVertical: 8,
  borderRadius: 22,
  backgroundColor: 'transparent',
  // shadow nhẹ để nổi lên
  elevation: 0,
},

centeredTabActive: {
  backgroundColor: '#f0f8ff', // nền nhẹ khi active
  borderRadius: 24,
  shadowColor: '#007AFF',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
},

centeredTabText: {
  fontSize: 16,
  color: '#4b5563', // xám đậm
  fontWeight: '600',
},

centeredTabTextActive: {
  color: '#007AFF',
  fontWeight: '700',
},

tabBadge: {
  marginLeft: 10,
  minWidth: 28,
  height: 24,
  paddingHorizontal: 6,
  borderRadius: 12,
  backgroundColor: '#007AFF',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#007AFF',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
  elevation: 2,
},

tabBadgeText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '700',
},

  scrollView: {
    flex: 1,
  },

  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubTitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },

  // Bill Card Styles
  billCard: {
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

  billHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start",
    marginBottom: 12,
  },

  billNameSection: {
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

  billTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#333",
    marginBottom: 2,
  },

  statusBadge: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16,
    backgroundColor: "#fff3cd"
  },
  
  statusDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 6,
    backgroundColor: "#ffc107"
  },
  
  statusText: { 
    fontSize: 13, 
    fontWeight: "600",
    color: "#856404"
  },

  billInfo: {
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

  billFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  paymentMethodContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  paymentMethodText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
  },

  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  paymentButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});
