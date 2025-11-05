// src/screens/ThanhToanScreen.js
import React, { useMemo, useState } from "react";
import {
  SafeAreaView, StatusBar, View, Text, TouchableOpacity,
  ScrollView, TextInput, StyleSheet
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

const currency = (n = 0) =>
  (Number(n) || 0).toLocaleString("vi-VN", {
    style: "currency", currency: "VND", maximumFractionDigits: 0
  });

export default function ThanhToanScreen({ navigation }) {
  const [paidBy] = useState("Tiền mặt");
  const [customerCash, setCustomerCash] = useState("");
  const subtotal = 0;
  const needToPay = subtotal;
  const change = useMemo(
    () => Number(customerCash || 0) - needToPay,
    [customerCash, needToPay]
  );

  const quicks = [0, 1000, 10000, 100000];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh Toán</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Thông tin hoá đơn */}
        <Section title="Thông tin hoá đơn" icon={<FontAwesome5 name="receipt" size={16} color="#111827" />}>
          <Row left="Dùng tại bàn" right="Khu vực 1 - 10" />
          <Row left="Thời gian bắt đầu" right="21:29 23/10/2025" />
        </Section>

        {/* Thông tin khách hàng */}
        <Section title="Thông tin khách hàng" icon={<Ionicons name="person-circle" size={18} color="#111827" />}>
          <TouchableOpacity style={styles.inputLike}>
            <Text style={styles.muted}>Khách lẻ</Text>
            <Ionicons name="search" size={18} color="#3b82f6" />
          </TouchableOpacity>
        </Section>

        {/* Thông tin thanh toán */}
        <Section title="Thông tin thanh toán" icon={<Ionicons name="cash-outline" size={18} color="#111827" />}>
          <Row left={`Tổng tạm tính (1)`} right={currency(subtotal)} />

          {/* Cần thanh toán */}
          <View style={styles.needPayBox}>
            <Text style={styles.needPayLabel}>Cần thanh toán</Text>
            <Text style={styles.needPayValue}>{currency(needToPay)}</Text>
          </View>

          {/* PT thanh toán */}
          <View style={styles.inline}>
            <Text style={styles.label}>PT thanh toán</Text>
            <View style={styles.methodBtn}>
              <Text style={styles.methodText}>{paidBy}</Text>
              <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
            </View>
          </View>

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
              />
            </View>
          </View>

          {/* Tiền thừa */}
          <Row left="Tiền thừa" right={currency(Math.max(change, 0))} />

          {/* Quick amounts */}
          <View style={styles.quickWrap}>
            {quicks.map((q) => (
              <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => setCustomerCash(String(q))}>
                <Text style={styles.quickText}>{currency(q)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Nút xác nhận -> sang màn thành công */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() =>
            navigation.navigate("PaymentSuccess", {
              area: "khu vực 1 - 10",
              need: needToPay,
              paid: Number(customerCash || 0),
              change: Math.max(change, 0),
            })
          }
        >
          <Text style={styles.primaryText}>Xác nhận thanh toán</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
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

// (giữ nguyên styles của bạn)
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F5F7FB" },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#111827" },
  container: { padding: 12, paddingBottom: 0 },
  section: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F4F6FA", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#E5EAF6" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionBody: { padding: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  rowLeft: { color: "#374151", fontSize: 14 },
  rowRight: { color: "#111827", fontSize: 14, fontWeight: "700" },
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
  quickText: { fontWeight: "700", color: "#111827" },
  primaryBtn: { marginTop: 4, backgroundColor: "#1677FF", paddingVertical: 14, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
});
