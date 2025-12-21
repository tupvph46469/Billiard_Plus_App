import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from "@expo/vector-icons";

export default function Header({ onMenuPress, onNotificationPress }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onMenuPress}>
        <Ionicons name="menu" size={28} color="#333" />
      </TouchableOpacity>
      <Image
        source={require("../../assets/logo.jpg")}
        style={styles.headerLogo}
        resizeMode="contain"
      />
      <View style={styles.notificationIcon}>
        <TouchableOpacity onPress={onNotificationPress}>
          <Ionicons name="notifications" size={28} color="#333" />
         
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerLogo: {
    width: 50,
    height: 50,
  },
  notificationIcon: {
    position: "relative",
  },
  
});