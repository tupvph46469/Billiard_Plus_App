import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const menuItems = [
  { id: 1, title: "Quản lý quán", icon: "restaurant", route: "Restaurant" },
  { id: 2, title: "Quản lý hóa đơn", icon: "receipt", route: "Bills" },
  { id: 3, title: "Hóa đơn điện tử", icon: "document-text", route: "EBills" },
  { id: 4, title: "Quản lý thu chi", icon: "cash", route: "Finance" },
  { id: 5, title: "Phiếu chi", icon: "document", route: "Expenses" },
  { id: 6, title: "Công nợ khách hàng", icon: "people", route: "Debts" },
  { id: 7, title: "Thiết lập ", icon: "settings", route: "Settings" },
  { id: 8, title: "Đăng xuất", icon: "log-out", route: "Logout" },
];

export default function Menu({ visible, onClose, navigation }) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={async () => {
                if (item.route === "Logout") {
                  // 👉 Xử lý đăng xuất ở đây
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "LoginScreen" }],
                  });

                  onClose();
                  return;
                }

                // 👉 Mặc định: điều hướng đến màn hình khác
                navigation.navigate(item.route);
                onClose();
              }}
            >
              <Ionicons name={item.icon} size={24} color="#666" />
              <Text style={styles.menuItemText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuContainer: {
    width: "80%",
    height: "100%",
    backgroundColor: "#fff",
    padding: 20,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuItemText: {
    marginLeft: 15,
    fontSize: 16,
    color: "#333",
  },
});
