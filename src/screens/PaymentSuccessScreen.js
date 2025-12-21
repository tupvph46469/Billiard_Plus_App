import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar, Animated, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

const currency = (n=0)=> (Number(n)||0).toLocaleString("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0});

// Thông tin cửa hàng
const STORE_INFO = {
  name: "Billiard Plus",
  phone: "0967771234",
  address: "Cầu Diên, Nam Từ Liêm, Hà Nội"
};

export default function PaymentSuccessScreen({ route, navigation }) {
  const { 
    need = 0, 
    paid = 0, 
    change = 0,
    shouldRefreshTables = false,
    tableName = "Bàn 1",
    items = [] // Danh sách món (nếu có)
  } = route.params || {};
  
  const [eInvoice, setEInvoice] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true
      }),
      Animated.timing(checkmarkAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();

    Animated.parallel([
      Animated.spring(badgeAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        delay: 200,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: 300,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  // Transaction ID và thời gian
  const transactionId = Math.random().toString(36).substr(2, 9).toUpperCase();
  const currentTime = new Date();
  const formattedTime = currentTime.toLocaleString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Tạo HTML cho hóa đơn
  const generateInvoiceHTML = () => {
    const invoiceDate = currentTime.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
      font-size: 14px;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .store-name {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .store-info {
      font-size: 12px;
      color: #555;
    }
    .invoice-title {
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      margin: 15px 0;
      text-transform: uppercase;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      font-size: 13px;
    }
    .info-label {
      font-weight: 600;
    }
    .divider {
      border-top: 1px dashed #333;
      margin: 15px 0;
    }
    .thick-divider {
      border-top: 2px dashed #333;
      margin: 15px 0;
    }
    .items-section {
      margin: 15px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 13px;
    }
    .total-section {
      margin-top: 15px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      font-size: 14px;
    }
    .total-row.highlight {
      font-weight: bold;
      font-size: 16px;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #333;
      font-size: 12px;
    }
    .thank-you {
      font-weight: bold;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="store-name">${STORE_INFO.name}</div>
    <div class="store-info">${STORE_INFO.address}</div>
    <div class="store-info">SĐT: ${STORE_INFO.phone}</div>
  </div>

  <!-- Invoice Title -->
  <div class="invoice-title">Hóa Đơn Bàn 10</div>

  <!-- Invoice Info -->
  <div class="info-row">
    <span class="info-label">Mã GD:</span>
    <span>#${transactionId}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Bàn:</span>
    <span>${tableName}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Giờ bắt đầu:</span>
    <span>20:37 13/12/2017</span>
  </div>
  <div class="info-row">
    <span class="info-label">Giờ kết thúc:</span>
    <span>${invoiceDate}</span>
  </div>

  <div class="thick-divider"></div>

  <!-- Items Section -->
  <div class="items-section">
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid #333;">
          <th style="text-align: left; padding: 8px 0; font-size: 13px;">Tên</th>
          <th style="text-align: center; padding: 8px 0; font-size: 13px;">SL</th>
          <th style="text-align: right; padding: 8px 0; font-size: 13px;">Giá</th>
          <th style="text-align: right; padding: 8px 0; font-size: 13px;">Tổng</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 5px 0;">Bia Larue -Lon</td>
          <td style="text-align: center; padding: 5px 0;">20</td>
          <td style="text-align: right; padding: 5px 0;">12.000</td>
          <td style="text-align: right; padding: 5px 0;">240.000</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Nước Bò Húc</td>
          <td style="text-align: center; padding: 5px 0;">4</td>
          <td style="text-align: right; padding: 5px 0;">15.000</td>
          <td style="text-align: right; padding: 5px 0;">60.000</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">-Chai</td>
          <td style="text-align: center; padding: 5px 0;"></td>
          <td style="text-align: right; padding: 5px 0;"></td>
          <td style="text-align: right; padding: 5px 0;"></td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Thuốc Ngựa -Gói</td>
          <td style="text-align: center; padding: 5px 0;">1</td>
          <td style="text-align: right; padding: 5px 0;">30.000</td>
          <td style="text-align: right; padding: 5px 0;">30.000</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Cafe Sữa Đá -Ly</td>
          <td style="text-align: center; padding: 5px 0;">1</td>
          <td style="text-align: right; padding: 5px 0;">15.000</td>
          <td style="text-align: right; padding: 5px 0;">15.000</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="divider"></div>

  <!-- Total Section -->
  <div class="total-section">
    <div class="total-row">
      <span>Tổng dịch vụ:</span>
      <span>345.000</span>
    </div>
    <div class="total-row">
      <span>Tổng tiền giờ:</span>
      <span>25.000</span>
    </div>
    <div class="total-row highlight">
      <span>Thanh toán:</span>
      <span>${currency(need)}</span>
    </div>
  </div>

  <div class="thick-divider"></div>

  <!-- Payment Details -->
  <div class="total-row">
    <span>Tiền khách trả:</span>
    <span>${currency(paid)}</span>
  </div>
  <div class="total-row">
    <span>Tiền thừa:</span>
    <span>${currency(change)}</span>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thank-you">Cảm ơn quý khách!</div>
    <div>Hẹn gặp lại</div>
    <div style="margin-top: 10px; font-size: 11px;">
      Giá giờ: 30.000 đ/giờ
    </div>
  </div>
</body>
</html>
    `;
  };

  // Xử lý xuất hóa đơn PDF
  const handlePrintInvoice = async () => {
    if (!eInvoice) {
      // Nếu chưa check vào checkbox, hiển thị thông báo
      Alert.alert(
        'Thông báo',
        'Vui lòng chọn "Xuất hóa đơn điện tử" để tạo hóa đơn PDF',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsPrinting(true);

      // Tạo HTML cho hóa đơn
      const html = generateInvoiceHTML();

      // Tạo PDF
      const { uri } = await Print.printToFileAsync({ 
        html,
        base64: false
      });

      console.log('✅ PDF đã tạo tại:', uri);

      // Hiển thị preview PDF (tự động mở)
      await Print.printAsync({ 
        uri,
        // Không cần máy in thật, chỉ hiển thị preview
      });

      console.log('✅ Đã hiển thị PDF preview');

      // Sau khi đóng PDF preview, tự động quay về trang chủ
      // Delay nhỏ để đảm bảo PDF preview đã đóng hoàn toàn
      setTimeout(() => {
        handleComplete();
      }, 500);

    } catch (error) {
      console.error('❌ Lỗi xuất PDF:', error);
      Alert.alert(
        'Lỗi',
        'Không thể xuất hóa đơn. Vui lòng thử lại.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleComplete = () => {
    if (shouldRefreshTables) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Main',
            params: {
              screen: 'Table',
              params: { refreshData: true }
            }
          }
        ]
      });
    } else {
      navigation.popToTop();
    }
  };

  // Xử lý nút "Hoàn tất thanh toán"
  const handleCompletePayment = () => {
    if (eInvoice) {
      // Nếu đã check xuất hóa đơn, gọi hàm xuất PDF
      handlePrintInvoice();
    } else {
      // Nếu không xuất hóa đơn, hoàn tất luôn
      handleComplete();
    }
  };

  const checkmarkRotate = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg']
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      
      {/* Banner với gradient */}
      <LinearGradient
        colors={['#16a34a', '#22c55e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.iconWrapper}>
          <Animated.View 
            style={[
              styles.iconCircle,
              {
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <Animated.View
              style={{
                opacity: checkmarkAnim,
                transform: [
                  { rotate: checkmarkRotate },
                  { scale: checkmarkAnim }
                ]
              }}
            >
              <Ionicons name="checkmark" size={60} color="#16a34a" />
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.ripple,
                {
                  opacity: scaleAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.3, 0]
                  }),
                  transform: [
                    { 
                      scale: scaleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.5]
                      })
                    }
                  ]
                }
              ]} 
            />
          </Animated.View>
        </View>
      </LinearGradient>

      {/* Nội dung */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Success Badge */}
        <Animated.View 
          style={{
            opacity: badgeAnim,
            transform: [
              { 
                scale: badgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              },
              {
                translateY: badgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }
            ]
          }}
        >
          <View style={styles.successBadge}>
            <View style={styles.badgeGlow} />
            <LinearGradient
              colors={['#16a34a', '#22c55e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badgeGradient}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.badgeText}>Thành công</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        <Text style={styles.title}>Thanh toán hoàn tất!</Text>
        
        {/* Timestamp và Transaction ID */}
        <View style={styles.metaInfo}>
          <View style={styles.subtitleWrapper}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.subtitle}>{formattedTime}</Text>
          </View>
          <Text style={styles.transactionId}>Mã GD: #{transactionId}</Text>
        </View>

        {/* Thông tin thanh toán */}
        <View style={styles.infoCard}>
          <Row left="Cần thanh toán" right={currency(need)} bold />
          <View style={styles.divider} />
          <Row left="Tiền khách trả" right={currency(paid)} />
          <View style={styles.divider} />
          <Row left="Tiền thừa trả khách" right={currency(change)} highlight />
        </View>

        {/* Checkbox hóa đơn điện tử */}
        <TouchableOpacity 
          onPress={() => setEInvoice(!eInvoice)} 
          style={styles.checkboxCard}
          activeOpacity={0.7}
          disabled={isPrinting}
        >
          <View style={styles.checkboxWrapper}>
            <View 
              style={[
                styles.checkbox, 
                eInvoice && styles.checkboxActive,
              ]}
            >
              {eInvoice && (
                <Ionicons name="checkmark" size={18} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkboxText}>Xuất hóa đơn điện tử</Text>
              <Text style={styles.checkboxSubtext}>
                Hóa đơn sẽ được tạo dưới dạng PDF
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Note về xuất hóa đơn */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.noteText}>
              {eInvoice 
                ? 'Nhấn "Hoàn tất" để xem và lưu hóa đơn PDF'
                : 'Chọn "Xuất hóa đơn điện tử" để tạo hóa đơn PDF'
              }
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Button hoàn tất */}
        <TouchableOpacity 
          style={[styles.primaryBtn, isPrinting && styles.primaryBtnDisabled]} 
          onPress={handleCompletePayment}
          activeOpacity={0.8}
          disabled={isPrinting}
        >
          <LinearGradient
            colors={['#1677FF', '#0ea5e9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {isPrinting ? (
              <>
                <Text style={styles.primaryText}>Đang tạo hóa đơn...</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryText}>
                  {eInvoice ? 'Xuất hóa đơn & Hoàn tất' : 'Hoàn tất thanh toán'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const Row = ({ left, right, bold, highlight }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLeft, bold && styles.rowBold]}>{left}</Text>
    <Text style={[styles.rowRight, bold && styles.rowBold, highlight && styles.rowHighlight]}>
      {right}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb"
  },
  banner: {
    height: 180,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 20
  },
  iconWrapper: {
    marginBottom: -40,
    position: "relative"
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  ripple: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#16a34a",
    zIndex: -1
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 50
  },
  successBadge: {
    alignSelf: "center",
    position: "relative",
    marginBottom: 16
  },
  badgeGlow: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: "#22c55e",
    opacity: 0.2,
    borderRadius: 20,
    zIndex: -1
  },
  badgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6
  },
  badgeText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    letterSpacing: -0.5
  },
  metaInfo: {
    alignItems: "center",
    marginBottom: 28
  },
  subtitleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500"
  },
  transactionId: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "600",
    fontFamily: "monospace",
    letterSpacing: 0.5
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  rowLeft: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500"
  },
  rowRight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827"
  },
  rowBold: {
    fontSize: 18,
    fontWeight: "800"
  },
  rowHighlight: {
    color: "#16a34a"
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 4
  },
  checkboxCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb"
  },
  checkboxWrapper: {
    flexDirection: "row",
    alignItems: "center"
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center"
  },
  checkboxActive: {
    backgroundColor: "#1677FF",
    borderColor: "#1677FF"
  },
  checkboxText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
  },
  checkboxSubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2
  },
  noteCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderLeftWidth: 4,
    borderLeftColor: "#0ea5e9"
  },
  noteText: {
    fontSize: 14,
    color: "#0369a1",
    lineHeight: 20
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#1677FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 16
  },
  primaryBtnDisabled: {
    opacity: 0.6
  },
  btnGradient: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5
  }
});