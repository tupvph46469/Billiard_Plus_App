import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import TableListScreen from "../screens/TableListScreen";
import PaymentScreen from "../screens/PaymentScreen";
import PaymentSuccessScreen from "../screens/PaymentScreen";
import ThanhToanScreen from "../screens/ThanhToanScreen";
import { Ionicons } from "@expo/vector-icons";
import OrderDetail from "../screens/OrderDetail";
const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#0099ff",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#ddd",
          height: 60,
          paddingBottom: 5,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === "Home") iconName = "home";
          else if (route.name === "Table") iconName = "grid-outline";
          else if (route.name === "Payment") iconName = "card";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Trang chủ" }} />
      <Tab.Screen name="Table" component={TableListScreen} options={{ title: "Bàn" }} />
      <Tab.Screen name="Payment" component={PaymentSuccessScreen} options={{ title: "Thanh toán" }} />
    </Tab.Navigator>
  );
}
