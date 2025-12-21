import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // ===== FORM =====
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const str = await AsyncStorage.getItem("user");

      if (!str) {
        Alert.alert("Lỗi", "Chưa đăng nhập");
        navigation.replace("LoginScreen");
        return;
      }

      const u = JSON.parse(str);
      setUser(u);

      setName(u.name || "");
      setEmail(u.email || "");
      setPhone(u.phone || "");
    } catch (e) {
      console.log("❌ Load user error:", e);
    } finally {
      setLoading(false);
    }
  };

  const onUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Lỗi", "Họ tên không được để trống");
      return;
    }

    const updatedUser = {
      ...user,
      name,
      email,
      phone,
    };

    // 🔥 LƯU LOCAL
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

    // 🔥 CẬP NHẬT STATE NGAY
    setUser(updatedUser);

    Alert.alert("Thành công", "Cập nhật thông tin thành công");
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const displayName = user?.name || "Người dùng";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ===== AVATAR ===== */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* 🔥 HIỂN TÊN THAY VÌ "QTRI VIÊN" */}
        <Text style={styles.name}>{displayName}</Text>
      </View>

      {/* ===== FORM ===== */}
      <View style={styles.form}>
        <Text style={styles.label}>Họ tên</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nhập họ tên"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="Nhập email"
        />

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Nhập số điện thoại"
        />
      </View>

      {/* ===== BUTTON ===== */}
      <Pressable style={styles.button} onPress={onUpdateProfile}>
        <Text style={styles.buttonText}>Cập nhật</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/* ===================== STYLE ===================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },

  avatarWrapper: {
    alignItems: "center",
    marginTop: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: "#E6EEF8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#16457A",
  },
  name: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  form: {
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 15,
  },

  button: {
    marginHorizontal: 16,
    marginTop: "auto",
    marginBottom: 24,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
