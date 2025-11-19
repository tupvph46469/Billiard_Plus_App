// Căn giữa toàn bộ giao diện (đã bỏ nút demo)
// Bạn thay thế toàn bộ file LoginScreen.js bằng nội dung dưới đây

import { authService } from "../services/authService";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tên đăng nhập");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập mật khẩu");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login(username, password);
      if (res?.token) {
        setTimeout(() => navigation.replace("Main"), 300);
      }
    } catch (err) {
      Alert.alert("Đăng nhập thất bại", "Sai tài khoản hoặc mật khẩu!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Billiard POS</Text>
          <Text style={styles.subtitle}>Quản lý câu lạc bộ bi-a</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Chào mừng trở lại</Text>
          <Text style={styles.welcomeSub}>Đăng nhập để tiếp tục</Text>

          {/* Username */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Tên đăng nhập"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" />
            <TextInput
              style={styles.input}
              placeholder="Mật khẩu"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={["#0099ff", "#00d68f"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginText}>Đăng nhập</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Phiên bản 1.0.0 • © 2025</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center", // CĂN GIỮA CHÍNH GIỮA
    alignItems: "center", // Căn giữa ngang
    paddingHorizontal: 28,
  },

  logoSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: { width: 120, height: 120, borderRadius: 8 },
  title: { fontSize: 26, fontWeight: "bold", marginTop: 16, color: "#222" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#777" },

  formContainer: {
    width: "100%",
  },

  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    textAlign: "left",
  },
  welcomeSub: {
    fontSize: 14,
    color: "#666",
    marginBottom: 22,
    textAlign: "left",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "100%",
  },
  input: { flex: 1, padding: 14, fontSize: 16, color: "#222" },

  loginButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 10,
    width: "100%",
  },
  loginGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    gap: 10,
  },
  loginText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  footer: { marginTop: 50, alignItems: "center" },
  footerText: { fontSize: 12, color: "#999" },
});
