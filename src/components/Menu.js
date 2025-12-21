import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  FlatList,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const BASE_DURATION = 220;

const defaultMenuItems = [
  { id: "management", title: "Quản lý quán", icon: "people", route: "Management", disabled: true },
  { id: "bills", title: "Quản lý hóa đơn", icon: "receipt", route: "Bills" },
  { id: "settings", title: "Thiết lập", icon: "settings", disabled: true },
  { id: "logout", title: "Đăng xuất", icon: "log-out", route: "Logout" },
];

export default function Menu({
  visible,
  onClose,
  navigation,
  items = defaultMenuItems,
}) {
  /* ===================== USER ===================== */
  const [user, setUser] = useState(null);

  // 🔥 LOAD USER MỖI LẦN MỞ MENU
  useEffect(() => {
    if (!visible) return;

    const loadUser = async () => {
      try {
        const str = await AsyncStorage.getItem("user");
        if (str) {
          setUser(JSON.parse(str));
        }
      } catch (e) {
        console.log("❌ Menu load user error:", e);
      }
    };

    loadUser();
  }, [visible]);

  /* ===================== ANIMATION ===================== */
  const screenWidth = Dimensions.get("window").width;
  const menuWidth = Math.min(420, screenWidth * 0.82);

  const [showModal, setShowModal] = useState(visible);

  const translateX = useRef(new Animated.Value(-menuWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: BASE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BASE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -menuWidth,
          duration: BASE_DURATION * 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: BASE_DURATION * 0.9,
          useNativeDriver: true,
        }),
      ]).start(() => setShowModal(false));
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -menuWidth,
        duration: BASE_DURATION * 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: BASE_DURATION * 0.9,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      onClose && onClose();
    });
  };

  /* ===================== MENU ACTION ===================== */
  const onItemPress = (item) => {
    if (item.route === "Logout") {
      AsyncStorage.removeItem("user");
      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
      handleClose();
      return;
    }

    if (item.disabled || !item.route) {
      Alert.alert("Thông báo", "Chức năng đang được phát triển");
      handleClose();
      return;
    }

    navigation.navigate(item.route);
    handleClose();
  };

  /* ===================== PROFILE ===================== */
  const name = user?.name?.trim() || "";
  const email = user?.email || "";

  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  const renderProfile = () => (
    <View style={styles.profileRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.profileMeta}>
        <Text style={styles.profileName} numberOfLines={1}>
          {name || " "}
        </Text>
        {email ? (
          <Text style={styles.profileEmail} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <Pressable
      onPress={() => !item.disabled && onItemPress(item)}
      style={[styles.menuItem, item.disabled && { opacity: 0.45 }]}
    >
      <View style={styles.iconWrapper}>
        <Ionicons name={item.icon} size={20} />
      </View>
      <Text style={styles.menuItemText}>{item.title}</Text>
      {!item.disabled && <Ionicons name="chevron-forward" size={18} />}
    </Pressable>
  );

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={handleClose}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      <View style={styles.container}>
        <Animated.View
          style={[
            styles.menuContainer,
            { width: menuWidth, transform: [{ translateX }] },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* HEADER */}
            <View style={styles.headerRow}>
              <Text style={styles.menuTitleText}>Menu</Text>
              <Pressable onPress={handleClose} style={styles.closeCircle}>
                <Ionicons name="close" size={20} />
              </Pressable>
            </View>

            <View style={styles.headerSeparator} />

            {/* PROFILE */}
            <Pressable
              onPress={() => {
                navigation.navigate("Profile");
                handleClose();
              }}
              style={{ paddingVertical: 8 }}
            >
              {renderProfile()}
            </Pressable>

            <View style={styles.separator} />

            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </Animated.View>

        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlayRight} />
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

/* ===================== STYLE ===================== */
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  container: { flex: 1, flexDirection: "row" },
  menuContainer: {
    height: "100%",
    backgroundColor: "#fff",
    padding: 14,
    elevation: 8,
  },
  safeArea: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuTitleText: { fontSize: 18, fontWeight: "700" },
  closeCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },

  headerSeparator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 8,
  },

  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#E6EEF8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#16457A" },
  profileMeta: { marginLeft: 12 },
  profileName: { fontSize: 16, fontWeight: "600" },
  profileEmail: { fontSize: 13, color: "#687684" },

  separator: {
    height: 1,
    backgroundColor: "#eef3f7",
    marginVertical: 12,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#f5f8fb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemText: { flex: 1, fontSize: 16 },

  overlayRight: { flex: 1 },
});
