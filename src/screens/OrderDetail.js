import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderDetail({ navigation, route }) {
  const [selectedTab, setSelectedTab] = useState('promotion');
  const [area, setArea] = useState('Khu vực 1 - 4');
  const [showMenu, setShowMenu] = useState(false); // 👈 Menu state

  const { cart = [], tableInfo = {} } = route?.params || {};

  // Dữ liệu mẫu cho order
  const orderItems = [
    { id: 1, name: 'Bida', price: 40000, quantity: 1, icon: '🎱' },
    { id: 2, name: 'Tiền hàng', price: 40000, quantity: 1, icon: '🧾' },
  ];

  const getTotalAmount = () => {
    return orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const renderOrderItem = (item) => (
    <View key={item.id} style={styles.orderItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemIcon}>{item.icon}</Text>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemQuantity}>{item.quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>{item.price.toLocaleString()}đ</Text>
    </View>
  );

  const renderTabContent = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabContentText}>
        {selectedTab === 'promotion' && 'Chưa có khuyến mại nào được áp dụng'}
        {selectedTab === 'discount' && 'Chưa có chiết khấu nào được áp dụng'}
        {selectedTab === 'tax' && 'Thuế VAT: 0%'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Tạo hoá đơn</Text>

        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Text style={styles.menuButton}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity style={styles.dropdown}>
          <Text style={styles.dropdownText}>{area}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Order list */}
      <ScrollView style={styles.orderList}>
        {orderItems.map((item) => renderOrderItem(item))}
      </ScrollView>

      {/* Total Section */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>SL: 1</Text>
        <Text style={styles.totalAmount}>
          Tổng: {getTotalAmount().toLocaleString()}đ
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'promotion' && styles.activeTab]}
          onPress={() => setSelectedTab('promotion')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'promotion' && styles.activeTabText]}
          >
            Khuyến mại
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'discount' && styles.activeTab]}
          onPress={() => setSelectedTab('discount')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'discount' && styles.activeTabText]}
          >
            Chiết khấu
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'tax' && styles.activeTab]}
          onPress={() => setSelectedTab('tax')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'tax' && styles.activeTabText]}
          >
            Thuế & Phí
          </Text>
        </TouchableOpacity>
      </View>

      {renderTabContent()}

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.addButton} onPress={() => {navigation.navigate('OrderScreen')}}>
          <Text style={styles.addButtonText}>● Thêm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Lưu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.payButton}
          onPress={() => navigation.navigate('ThanhToan')}
        >
          <Text style={styles.payButtonText}>Thanh toán</Text>
        </TouchableOpacity>
      </View>

      {/* ===========================
          MENU 3 CHẤM (OVERFLOW MENU)
          =========================== */}
      {showMenu && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuBox}>
            {[
              'Yêu cầu thanh toán',
              'Lưu & in tạm tính',
              'Lưu & in phiếu bếp',
              'In phiếu kiểm đồ',
              'Tạo đơn mới trên bàn này',
              'Gộp đơn',
              'Hủy đơn',
              'Thay đổi bàn',
              'Khách hàng',
            ].map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem}>
                <Text style={styles.menuText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

/* STYLE */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: { fontSize: 24, color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  menuButton: { fontSize: 22, fontWeight: 'bold', color: '#333' },

  dropdownContainer: {
    backgroundColor: '#fff',
    padding: 12,
  },
  dropdown: {
    backgroundColor: '#f1f1f1',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: { flex: 1, fontSize: 14 },
  dropdownArrow: { fontSize: 12 },

  orderList: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIcon: { fontSize: 22, marginRight: 10 },
  itemName: { flex: 1, fontSize: 16 },
  itemQuantity: {
    backgroundColor: '#e3f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  itemPrice: { fontSize: 16, fontWeight: 'bold' },

  totalSection: {
    backgroundColor: '#e8f4ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  totalLabel: { color: '#666' },
  totalAmount: { fontWeight: 'bold' },

  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2196F3' },
  tabText: { color: '#777' },
  activeTabText: { color: '#2196F3', fontWeight: '600' },

  tabContent: {
    backgroundColor: '#fff',
    padding: 20,
    minHeight: 80,
  },
  tabContentText: {
    textAlign: 'center',
    color: '#777',
  },

  bottomButtons: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 10,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },

  saveButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: { fontWeight: '600' },

  payButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: '600' },

  /* MENU 3 CHẤM */
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  menuBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 20,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: { fontSize: 16, color: '#222' },
});
