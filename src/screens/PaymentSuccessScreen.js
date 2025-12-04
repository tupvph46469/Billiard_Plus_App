// Full-bleed layout (không còn card bo góc & viền)
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const currency = (n=0)=> (Number(n)||0).toLocaleString("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0});

export default function PaymentSuccessScreen({ route, navigation }) {
  const { 
    area = "khu vực 1 - 10", 
    need = 0, 
    paid = 0, 
    change = 0,
    shouldRefreshTables = false 
  } = route.params || {};
  const [eInvoice, setEInvoice] = useState(false);

  // ✅ THÊM: Logic xử lý navigation với refresh
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Banner */}
      <View style={styles.banner} />
      {/* Nội dung */}
      <View style={styles.content}>
        <Ionicons name="checkmark" size={90} color="#16a34a" />
        <Text style={styles.title}>Thanh toán hóa đơn thành công</Text>
        <Text style={styles.area}>{area}</Text>

        <View style={{ marginTop: 18, gap: 12, width: "100%" }}>
          <Row left="Cần thanh toán" right={currency(need)} />
          <Row left="Tiền khách trả:" right={currency(paid)} />
          <Row left="Tiền thừa:" right={currency(change)} />
        </View>

        <TouchableOpacity onPress={() => setEInvoice(!eInvoice)} style={styles.checkboxRow}>
          <Ionicons name={eInvoice ? "checkbox" : "square-outline"} size={22} color="#111827" />
          <Text style={{ marginLeft: 8, fontSize: 14 }}>Yêu cầu xuất hóa đơn điện tử</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 8, alignItems: "center" }}>
          <Text style={styles.note}>Thiết bị chưa được kết nối máy in</Text>
          <Text style={styles.note}>
            Nếu muốn in hóa đơn vui lòng kết nối{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("https://example.com")}>tại đây</Text>
          </Text>
        </View>

        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleComplete}>
          <Text style={styles.primaryText}>Hoàn tất thanh toán</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const Row = ({ left, right }) => (
  <View style={styles.row}>
    <Text style={styles.rowLeft}>{left}</Text>
    <Text style={styles.rowRight}>{right}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  banner: {
    height: 120,
    backgroundColor: "#eef0ff"
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: "center"
  },
  title: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#0f1a40",
    marginTop: 10
  },
  area: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  rowLeft: {
    fontSize: 18,
    fontWeight: "600"
  },
  rowRight: {
    fontSize: 18,
    fontWeight: "700"
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18
  },
  note: {
    color: "#111827",
    textAlign: "center",
    marginTop: 6
  },
  link: {
    color: "#0ea5e9",
    fontWeight: "700"
  },
  primaryBtn: {
    backgroundColor: "#1677FF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 16
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800"
  },
});
