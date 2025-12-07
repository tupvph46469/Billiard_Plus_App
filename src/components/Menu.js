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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const BASE_DURATION = 220;

const defaultMenuItems = [
  { id: "management", title: "Quản lý câu lạc bộ", icon: "people", route: "Management" },
  { id: "bills", title: "Quản lý hóa đơn", icon: "receipt", route: "Bills" },
  { id: "settings", title: "Thiết lập", icon: "settings", route: "Settings" },
  { id: "logout", title: "Đăng xuất", icon: "log-out", route: "Logout" },
];

export default function Menu({
  visible,
  onClose,
  navigation,
  items = defaultMenuItems,
  user = null, // optional: { name, email, role }
}) {
  const screenWidth = Dimensions.get("window").width;
  const menuWidth = Math.min(420, screenWidth * 0.82); // max width for tablets
  const translateX = useRef(new Animated.Value(-menuWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);

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
    } else if (showModal) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onItemPress = (item) => {
    if (item.route === "Logout") {
      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
      handleClose();
      return;
    }

    navigation.navigate(item.route);
    handleClose();
  };

  const renderProfile = () => {
    const name = user?.name || "Quản trị viên";
    const email = user?.email || null;
    const initials = name
      .split(" ")
      .map(p => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.profileMeta}>
          <Text style={styles.profileName} numberOfLines={1}>
            {name}
          </Text>
          {email ? <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text> : null}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    return (
      <Pressable
        onPress={() => onItemPress(item)}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={({ pressed }) => [
          styles.menuItem,
          pressed && styles.menuItemPressed,
          // scale effect for press
          {
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
        accessibilityLabel={item.title}
        accessibilityRole="button"
        hitSlop={8}
      >
        <View style={styles.iconWrapper}>
          <Ionicons name={item.icon} size={20} color="#2f3b4a" />
        </View>
        <Text style={styles.menuItemText}>{item.title}</Text>
        <Ionicons name="chevron-forward" size={18} color="#9aa6b2" />
      </Pressable>
    );
  };

  return (
    <Modal
      transparent
      visible={showModal}
      onRequestClose={handleClose}
      statusBarTranslucent
      animationType="none"
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              width: menuWidth,
              transform: [{ translateX }],
            },
          ]}
        >
          <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
            {/* ---------- HEADER ---------- */}
            <View style={styles.headerRow}>
              {/* left: profile (avatar + title) */}
              <View style={styles.headerLeft}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>
                    {(user?.name || "QT").split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.headerTitleBlock}>
                  <Text style={styles.menuTitleText}>Menu</Text>
                  <Text style={styles.roleText}>{user?.role || "Quản trị viên"}</Text>
                </View>
              </View>

              {/* right: close button in circle */}
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.closeCircle,
                  pressed && styles.closeCirclePressed,
                ]}
                accessibilityLabel="Đóng menu"
                accessibilityRole="button"
                android_ripple={{ color: "rgba(0,0,0,0.06)", radius: 26 }}
              >
                <Ionicons name="close" size={20} color="#2f3b4a" />
              </Pressable>
            </View>

            <View style={styles.headerSeparator} />

            {/* PROFILE / META */}
            <View style={{ paddingVertical: 8 }}>
              {renderProfile()}
            </View>

            <View style={styles.separator} />

            <FlatList
              data={items}
              keyExtractor={(it) => it.id?.toString() || it.title}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.footerNote}>
              <Text style={styles.footerText}>Ứng dụng quản lý - Phiên bản 1.0</Text>
            </View>
          </SafeAreaView>
        </Animated.View>

        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlayRight} />
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  container: {
    flex: 1,
    flexDirection: "row",
  },
  menuContainer: {
    height: "100%",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  safeArea: {
    flex: 1,
  },

  /* Header improved */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarSmall: {
    width: 40,   // reduced from 44 -> 40
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarSmallText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f4a78",
  },
  headerTitleBlock: {
    flexShrink: 1,
  },
  menuTitleText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f1724",
  },
  roleText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4, // increased spacing between title and role
  },
   closeCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,36,0.04)",
  },
  closeCirclePressed: {
    backgroundColor: "rgba(15,23,36,0.08)",
  },
  headerSeparator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginTop: 8,
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  avatar: {
    width: 56, // reduced from 64 -> 56
    height: 56,
    borderRadius: 12,
    backgroundColor: "#E6EEF8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    color: "#16457A",
    fontWeight: "700",
  },
  profileMeta: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f1724",
  },
  profileEmail: {
    fontSize: 13,
    color: "#687684",
    marginTop: 2,
  },

  separator: {
    height: 1,
    backgroundColor: "#eef3f7",
    marginVertical: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginBottom: 6,
  },
  menuItemPressed: {
    backgroundColor: "rgba(20,40,60,0.03)",
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
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#132230",
  },
  overlayRight: {
    flex: 1,
  },
  footerNote: {
    marginTop: "auto",
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 12,
    color: "#9aa6b2",
  },
});
