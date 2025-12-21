// src/screens/ThanhToanScreen.js
import React, { useState, useMemo } from "react";
import {
  SafeAreaView, StatusBar, View, Text, TouchableOpacity,
  ScrollView, TextInput, StyleSheet, ActivityIndicator, Alert, Modal
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import api from '../services/api';
import { sessionService } from '../services/sessionService';

const currency = (n = 0) =>
  (Number(n) || 0).toLocaleString("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0
  });

export default function ThanhToanScreen({ navigation, route }) {
  const [paidBy, setPaidBy] = useState("Tiền mặt");
  const [customerCash, setCustomerCash] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Danh sách phương thức thanh toán
  const paymentMethods = [
    { key: 'cash', label: 'Tiền mặt', icon: 'cash' },
    { key: 'transfer', label: 'Chuyển khoản', icon: 'card' },
    { key: 'card', label: 'Thẻ', icon: 'card-outline' }
  ];

  // Lấy params từ navigation - hỗ trợ cả OrderDetail và PaymentScreen
  const { 
    // Từ OrderDetail (tạo bill mới)
    sessionId, 
    tableName, 
    tableId,
    totalAmount, 
    originalAmount, // ✅ THÊM: Tổng tiền gốc
    discount, // ✅ THÊM: Số tiền giảm giá
    appliedPromotions, // ✅ THÊM: Danh sách promotion đã áp dụng
    playingTime, 
    ratePerHour, 
    sessionData,
    
    // Từ PaymentScreen (bill có sẵn) 
    billId,
    billData,
    isExistingBill,
    billCode,
    playAmount,
    serviceAmount,
    subTotal,
    paymentMethod
  } = route?.params || {};

  // ✅ SỬA: Thêm validation và default values an toàn
  const actualTotalAmount = Number(totalAmount) || 0;
  const actualOriginalAmount = Number(originalAmount) || 0;
  const actualDiscount = Number(discount) || 0;
  const actualTableName = tableName || "Không xác định";
  const actualBillCode = billCode || billId || sessionId || "N/A";

  // Chuyển đổi label sang key cho API
  const getPaymentMethodKey = (label) => {
    const method = paymentMethods.find(m => m.label === label);
    return method ? method.key : 'cash';
  };

  // Kiểm tra xem có phải phương thức tiền mặt không
  const isCashPayment = paidBy === "Tiền mặt";

  // ✅ SỬA: Logic xử lý thanh toán với validation
  const handlePayment = async () => {
    try {
      setProcessing(true);
      
      // Kiểm tra thông tin cần thiết
      if (!actualTotalAmount || actualTotalAmount <= 0) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin số tiền thanh toán hợp lệ');
        return;
      }

      let paidAmount = actualTotalAmount; // Mặc định bằng tổng hóa đơn

      // Chỉ kiểm tra tiền khách trả nếu là thanh toán tiền mặt
      if (isCashPayment) {
        paidAmount = Number(customerCash) || 0;
        if (paidAmount < actualTotalAmount) {
          Alert.alert('Lỗi', `Số tiền khách trả không đủ. Cần: ${currency(actualTotalAmount)}`);
          return;
        }
      }

      let finalBillId;
      let finalBillCode;
      const methodKey = getPaymentMethodKey(paidBy);

      if (methodKey === 'transfer') {
        // Chuyển khoản: không đánh dấu paid tại đây, dẫn sang màn QR / poll
        if (isExistingBill && billId) {
          // Ensure the bill has paymentMethod set to transfer (not paid)
          try {
            await api.patch(`/bills/${billId}`, { paymentMethod: methodKey });
          } catch (err) {
            // Not fatal; continue
            console.warn('Failed to set bill paymentMethod to transfer', err);
          }

          finalBillId = billId;
          finalBillCode = billCode || billId;

        } else if (sessionId) {
          // Create bill from session but keep paid = false so external payment can confirm
          const checkoutResponse = await sessionService.checkout(sessionId, {
            endAt: new Date(),
            paymentMethod: methodKey,
            paid: false,
            note: 'Thanh toán chuyển khoản - chờ xác nhận'
          });

          const createdBill = checkoutResponse.data || checkoutResponse;
          finalBillId = createdBill._id || createdBill.id;
          finalBillCode = createdBill.code || finalBillId;

        } else {
          Alert.alert('Lỗi', 'Không có thông tin hóa đơn để thanh toán');
          return;
        }

        // Navigate to QR / transfer payment screen
        navigation.replace('ThanhToanBank', {
          billId: finalBillId,
          billCode: finalBillCode,
          tableName: actualTableName,
          need: actualTotalAmount,
        });

        return;
      }

      if (isExistingBill && billId) {
        // Case 1: Thanh toán bill có sẵn từ PaymentScreen
        await api.patch(`/bills/${billId}/pay`, {
          paymentMethod: methodKey
        });
        
        finalBillId = billId;
        finalBillCode = billCode || billId;
        
      } else if (sessionId) {
        // Case 2: Tạo bill mới từ session (OrderDetail)
        const checkoutResponse = await sessionService.checkout(sessionId, {
          endAt: new Date(),
          paymentMethod: methodKey,
          paid: true,
          note: 'Thanh toán trực tiếp'
        });

        const createdBill = checkoutResponse.data || checkoutResponse;
        finalBillId = createdBill._id || createdBill.id;
        finalBillCode = createdBill.code || finalBillId;
        
      } else {
        Alert.alert('Lỗi', 'Không có thông tin hóa đơn để thanh toán');
        return;
      }

      // ✅ THÊM: Chuẩn bị params cho success screen với refreshData
      const successParams = {
        sessionId: sessionId || 'completed',
        billId: finalBillId,
        tableName: actualTableName,
        area: "Khu vực 1",
        need: actualTotalAmount,
        paid: paidAmount,
        change: Math.max(paidAmount - actualTotalAmount, 0),
        billCode: finalBillCode,
        // ✅ THÊM: Flag để báo success screen cần refresh table data
        shouldRefreshTables: true
      };

      // Chuyển tới màn thành công
      navigation.replace("ThanhToanSuccess", successParams);

    } catch (error) {
      console.error('❌ Payment error:', error);
      let errorMessage = 'Không thể xử lý thanh toán';
      if (error.response?.status === 400) {
        errorMessage = 'Thông tin thanh toán không hợp lệ';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy hóa đơn';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Lỗi thanh toán', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  // ✅ SỬA: Tính toán các giá trị với validation
  const subtotal = actualTotalAmount;
  const needToPay = subtotal;
  const change = useMemo(
    () => isCashPayment ? Math.max((Number(customerCash) || 0) - needToPay, 0) : 0,
    [customerCash, needToPay, isCashPayment]
  );

  const quicks = [0, needToPay, Math.ceil(needToPay / 100000) * 100000];

  // Format thời gian hiện tại
  const formatTime = () => {
    return new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Modal chọn phương thức thanh toán
  const PaymentMethodModal = () => (
    <Modal
      visible={showPaymentModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPaymentModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Phương thức thanh toán</Text>
            <TouchableOpacity 
              onPress={() => setShowPaymentModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Danh sách phương thức */}
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.key}
                style={styles.methodItem}
                onPress={() => {
                  setPaidBy(method.label);
                  setShowPaymentModal(false);
                }}
              >
                <View style={styles.methodLeft}>
                  <View style={styles.methodIcon}>
                    <Ionicons name={method.icon} size={24} color="#007AFF" />
                  </View>
                  <Text style={styles.methodLabel}>{method.label}</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  paidBy === method.label && styles.radioButtonSelected
                ]}>
                  {paidBy === method.label && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  // ✅ SỬA: Validation - kiểm tra chặt chẽ hơn
  if (!actualTotalAmount || actualTotalAmount <= 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={48} color="#f59e0b" />
          <Text style={styles.errorText}>
            Thông tin thanh toán không hợp lệ.{'\n'}
            Vui lòng quay lại và thử lại.
          </Text>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh Toán</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Thông tin hoá đơn */}
        <Section title="Thông tin hoá đơn" icon={<FontAwesome5 name="receipt" size={16} color="#111827" />}>
          <Row left="Dùng tại bàn" right={actualTableName} />
          <Row left={isExistingBill ? "Mã hóa đơn" : "Mã phiên"} right={actualBillCode} />
          <Row left="Thời gian tạo" right={formatTime()} />
          <Row left="Trạng thái" right={isExistingBill ? "Chờ thanh toán" : "Đang tạo hóa đơn"} />
        </Section>

        {/* ✅ SỬA: Thông tin thanh toán với validation chặt chẽ */}
        <Section title="Thông tin thanh toán" icon={<Ionicons name="cash-outline" size={18} color="#111827" />}>
          {/* Hiển thị tổng tiền gốc nếu có khuyến mãi */}
          {actualDiscount > 0 && actualOriginalAmount > 0 && (
            <Row left="Tổng tiền gốc" right={currency(actualOriginalAmount)} />
          )}
          
          {/* Hiển thị khuyến mãi đã áp dụng */}
          {actualDiscount > 0 && (
            <Row left="Khuyến mãi" right={`-${currency(actualDiscount)}`} />
          )}
          
          <Row left={`Tổng hóa đơn`} right={currency(subtotal)} />

          {/* Cần thanh toán */}
          <View style={styles.needPayBox}>
            <Text style={styles.needPayLabel}>Cần thanh toán</Text>
            <Text style={styles.needPayValue}>{currency(needToPay)}</Text>
          </View>

          {/* PT thanh toán */}
          <View style={styles.inline}>
            <Text style={styles.label}>PT thanh toán</Text>
            <TouchableOpacity 
              style={styles.methodBtn}
              onPress={() => setShowPaymentModal(true)}
            >
              <Text style={styles.methodText}>{paidBy}</Text>
              <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          {/* Chỉ hiển thị phần nhập tiền khách trả khi chọn Tiền mặt */}
          {isCashPayment && (
            <>
              {/* Nhập tiền khách trả */}
              <View style={styles.inline}>
                <Text style={styles.label}>Nhập tiền khách trả</Text>
                <View style={styles.amountInputWrap}>
                  <TextInput
                    value={customerCash}
                    onChangeText={setCustomerCash}
                    placeholder="0đ"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    style={styles.amountInput}
                    editable={!processing}
                  />
                </View>
              </View>

              {/* Tiền thừa */}
              <Row left="Tiền thừa" right={currency(change)} />

              {/* Quick amounts */}
              <View style={styles.quickWrap}>
                {quicks.map((q, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.quickBtn, processing && styles.quickBtnDisabled]}
                    onPress={() => setCustomerCash(String(q))}
                    disabled={processing}
                  >
                    <Text style={styles.quickText}>{currency(q)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Hiển thị thông báo cho phương thức không phải tiền mặt */}
          {!isCashPayment && (
            <View style={styles.nonCashInfo}>
              <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.nonCashText}>
                Thanh toán bằng {paidBy.toLowerCase()} - Số tiền: {currency(needToPay)}
              </Text>
            </View>
          )}
        </Section>

        {/* Nút xác nhận */}
        <TouchableOpacity
          style={[styles.primaryBtn, processing && styles.primaryBtnDisabled]}
          onPress={handlePayment}
          disabled={processing}
        >
          {processing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.primaryText, { marginLeft: 8 }]}>Đang xử lý...</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>Xác nhận thanh toán</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal chọn phương thức thanh toán */}
      <PaymentMethodModal />
    </SafeAreaView>
  );
}

const Section = ({ title, icon, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const Row = ({ left, right }) => (
  <View style={styles.row}>
    <Text style={styles.rowLeft}>{left}</Text>
    <Text style={styles.rowRight}>{right}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F5F7FB" },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#111827" },
  container: { padding: 12, paddingBottom: 0 },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 24,
  },
  backBtnText: {
    color: '#1677FF',
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
  },
  
  section: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F4F6FA", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#E5EAF6" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionBody: { padding: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  rowLeft: { color: "#374151", fontSize: 14, flex: 1 },
  rowRight: { color: "#111827", fontSize: 14, fontWeight: "700", textAlign: "right" },
  inputLike: { height: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  muted: { color: "#6B7280", fontSize: 14 },
  needPayBox: { marginTop: 6, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#F9FAFB" },
  needPayLabel: { color: "#6B7280", fontSize: 13, marginBottom: 4, fontWeight: "600" },
  needPayValue: { color: "#111827", fontSize: 20, fontWeight: "800" },
  inline: { marginTop: 8, marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "#374151", fontSize: 14 },
  methodBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  methodText: { color: "#3b82f6", fontSize: 14, fontWeight: "700" },
  amountInputWrap: { width: 140, height: 40, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, justifyContent: "center" },
  amountInput: { fontSize: 16, fontWeight: "700", color: "#111827" },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  quickBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  quickBtnDisabled: { opacity: 0.5 },
  quickText: { fontWeight: "700", color: "#111827" },
  
  primaryBtn: { marginTop: 4, backgroundColor: "#1677FF", paddingVertical: 14, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },

  toggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#111827',
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleInactive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },

  methodsList: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodLabel: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },

  // Thêm styles mới cho thông báo non-cash
  nonCashInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  nonCashText: {
    fontSize: 14,
    color: '#1d4ed8',
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },
});
