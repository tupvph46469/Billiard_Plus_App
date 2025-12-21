import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text } from "react-native";

import BottomTabNavigator from "./BottomTabNavigator";
import OrderScreen from "../screens/OrderScreen";
import OrderDetail from "../screens/OrderDetail";
import ChooseTableScreen from "../screens/ChooseTableScreen";
import LoginScreen from "../screens/LoginScreen";
import ThanhToanScreen from "../screens/ThanhToanScreen";
import ThanhToanBankScreen from "../screens/ThanhToanBankScreen";
import PaymentSuccessScreen from "../screens/PaymentSuccessScreen";
import QLHoaDonScreen from "../screens/QLHoaDonScreen";
import InvoiceDetailScreen from "../screens/InvoiceDetailScreens";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen"; 

// Component tạm cho các màn chưa làm
const DummyScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <Text>This is {route.name} Screen</Text>
  </View>
);

// Các màn chưa triển khai
const RestaurantScreen = props => <DummyScreen {...props} />;
const BillsScreen = props => <QLHoaDonScreen {...props} />;
const EBillsScreen = props => <DummyScreen {...props} />;
const FinanceScreen = props => <DummyScreen {...props} />;
const ExpensesScreen = props => <DummyScreen {...props} />;
const DebtsScreen = props => <DummyScreen {...props} />;
const SettingsScreen = props => <DummyScreen {...props} />;

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="LoginScreen"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="Main" component={BottomTabNavigator} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="OrderScreen" component={OrderScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetail} />
        <Stack.Screen name="ChooseTableScreen" component={ChooseTableScreen} />
        <Stack.Screen name="ThanhToan" component={ThanhToanScreen} />
        <Stack.Screen name="ThanhToanBank" component={ThanhToanBankScreen} />
        <Stack.Screen name="ThanhToanSuccess" component={PaymentSuccessScreen} />
        <Stack.Screen name="Restaurant" component={RestaurantScreen} />
        <Stack.Screen name="Bills" component={BillsScreen} />
        <Stack.Screen name="EBills" component={EBillsScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="Expenses" component={ExpensesScreen} />
        <Stack.Screen name="Debts" component={DebtsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />

        
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
        />

        <Stack.Screen
          name="InvoiceDetail"
          component={InvoiceDetailScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
