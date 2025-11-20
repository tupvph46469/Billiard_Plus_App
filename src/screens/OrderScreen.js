import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  ToastAndroid, // Thêm import
  Platform, // Thêm import
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMenuCategories, getMenuItems } from '../services/productService';
import { sessionService } from '../services/sessionService';
import { Ionicons } from '@expo/vector-icons';
import { CONFIG } from '../constants/config';

// Hàm lấy URL hình ảnh sản phẩm
const BASE_URL = CONFIG.baseURL.replace(/\/$/, ''); // bỏ dấu / cuối nếu có

function getProductImageUrl(item) {
  const images = item.images || [];
  const imagePath =
    Array.isArray(images) && images.length > 0 ? images[0] : null;

  if (!imagePath) return null;
  // Nếu backend đã trả full URL rồi thì dùng luôn
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Nếu là path kiểu "/uploads/..." thì ghép với BASE_URL
  if (imagePath.startsWith('/')) {
    return `${BASE_URL}${imagePath}`;
  }

  // Nếu là "uploads/..." thì thêm dấu /
  return `${BASE_URL}/${imagePath}`;
}

function getCategoryIcon(category, isActive) {
  const color = isActive ? '#1e293b' : '#1e293b';
  const size = 22;

  const code = (category.code || category.name || '').toLowerCase();

  if (code.includes('ăn') || code.includes('food') || code === 'do_an') {
    return <Ionicons name="fast-food-outline" size={size} color={color} />;
  }

  if (code.includes('uống') || code.includes('drink') || code === 'do_uong') {
    return <Ionicons name="beer-outline" size={size} color={color} />;
  }

  if (code.includes('chơi') || code.includes('play') || code === 'gio_choi') {
    return <Ionicons name="game-controller-outline" size={size} color={color} />;
  }

  return <Ionicons name="grid-outline" size={size} color={color} />;
}

// Thêm hàm showToast giống OrderDetail
const showToast = (message, type = 'success') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // Cho iOS, sử dụng Alert với timeout ngắn
    Alert.alert('', message, [], { cancelable: true });
    setTimeout(() => {
      // Tự động đóng alert sau 2 giây (iOS không có API để đóng)
    }, 2000);
  }
};

export default function OrderScreen({ navigation, route }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuData, setMenuData] = useState({});
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [addingItem, setAddingItem] = useState(null);

  // Lấy params từ navigation
  const { tableId, tableName, ratePerHour, sessionId } = route.params || {};

  // Load data khi component mount
  useEffect(() => {
    loadCategories();
    // Nếu có sessionId từ params, load session hiện có
    if (sessionId) {
      loadExistingSession();
    }
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadMenuItems(selectedCategory);
    }
  }, [selectedCategory]);

  // Load existing session nếu có
  const loadExistingSession = useCallback(async () => {
    try {
      console.log('📋 Loading existing session:', sessionId);
      const response = await sessionService.getById(sessionId);
      setCurrentSession(response.data || response);
      console.log('✅ Existing session loaded');
    } catch (error) {
      console.error('❌ Error loading existing session:', error);
    }
  }, [sessionId]);

  // Tạo session mới và thêm item đầu tiên
  const createSessionAndAddItem = useCallback(async (product) => {
    try {
      console.log('🔓 Creating new session for table:', tableId);
      console.log('🔍 Current params state:', { tableId, tableName, ratePerHour, sessionId });

      if (!tableId) {
        console.error('❌ No tableId available. Route params:', route.params);
        showToast('❌ Không tìm thấy thông tin bàn. Vui lòng quay lại và chọn bàn lại.', 'error');
        return;
      }

      // Bước 1: Tạo session mới
      const sessionData = {
        tableId: tableId,
        startAt: new Date(),
        note: `Bắt đầu với ${product.name}`
      };

      console.log('📤 Creating session with data:', sessionData);
      const sessionResponse = await sessionService.open(sessionData);

      // Backend trả về { data: session, message, status }
      const newSession = sessionResponse.data;

      console.log('✅ New session created:', newSession);
      setCurrentSession(newSession);

      // Bước 2: Thêm item vào session vừa tạo
      const itemData = {
        productId: product._id || product.id,
        qty: 1,
        note: `Món đầu tiên`
      };

      console.log('📤 Adding first item:', itemData);
      const addResponse = await sessionService.addItem(newSession._id || newSession.id, itemData);
      const updatedSession = addResponse.data;

      setCurrentSession(updatedSession);

      // Hiển thị toast đơn giản
      showToast('Thêm thành công');

    } catch (error) {
      console.error('❌ Error creating session or adding item:', error);
      console.error('❌ Error details:', error.response?.data);

      let errorMessage = 'Không thể tạo phiên chơi';
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Dữ liệu không hợp lệ';
      } else if (error.response?.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn';
      } else if (error.response?.status === 409) {
        errorMessage = 'Bàn đang có phiên mở rồi';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      // Hiển thị toast lỗi
      showToast(`❌ ${errorMessage}`, 'error');
    }
  }, [tableId, tableName, route.params]);

  // Thêm item vào session hiện có hoặc tạo session mới
  const handleAddItem = useCallback(async (product) => {
    const productId = product._id || product.id;

    try {
      setAddingItem(productId);
      console.log('➕ Adding product:', product.name);

      if (!currentSession) {
        // Tạo session mới và add item
        console.log('🔄 No session exists, creating new session...');
        await createSessionAndAddItem(product);
      } else {
        // Thêm vào session hiện có
        console.log('🔄 Adding to existing session...');

        const itemData = {
          productId: productId,
          qty: 1,
          note: ''
        };

        const sessionIdToUse = currentSession._id || currentSession.id;
        const response = await sessionService.addItem(sessionIdToUse, itemData);

        // Backend trả về { data: session, message, status }
        setCurrentSession(response.data);

        // Hiển thị toast đơn giản
        showToast('Thêm thành công');

        console.log('✅ Item added to existing session');
      }

    } catch (error) {
      console.error('❌ Error adding item:', error);

      let errorMessage = 'Không thể thêm sản phẩm';
      if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Sản phẩm không khả dụng';
      } else if (error.response?.status === 409) {
        errorMessage = 'Phiên đã đóng, không thể thêm món';
      }

      // Hiển thị toast lỗi
      showToast(`❌ ${errorMessage}`, 'error');
    } finally {
      setAddingItem(null);
    }
  }, [currentSession, createSessionAndAddItem]);

  // Load categories
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMenuCategories();
      setCategories(list);

      if (list.length > 0) {
        setSelectedCategory(list[0]._id || list[0].id);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load menu items
  const loadMenuItems = useCallback(async (categoryId) => {
    setCategoryLoading(true);
    try {
      const items = await getMenuItems(categoryId);
      setMenuData(prev => ({
        ...prev,
        [categoryId]: items
      }));
    } catch (error) {
      console.error(`Error loading menu items:`, error);
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  // Tính tổng giá tiền từ session items
  const getTotalPrice = useCallback(() => {
    if (!currentSession?.items || currentSession.items.length === 0) {
      return 0;
    }

    return currentSession.items.reduce((total, item) => {
      const price = Number(item.priceSnapshot || 0);
      const qty = Number(item.qty || 0);
      return total + (price * qty);
    }, 0);
  }, [currentSession]);

  // Tính tổng số lượng items
  const getTotalItems = useCallback(() => {
    if (!currentSession?.items || currentSession.items.length === 0) {
      return 0;
    }

    return currentSession.items.reduce((total, item) => {
      return total + Number(item.qty || 0);
    }, 0);
  }, [currentSession]);

  // Xử lý khi nhấn "Tiếp theo"
  const handleContinue = useCallback(() => {
    if (currentSession) {
      // Chuyển đến OrderDetail với đầy đủ params
      navigation.navigate('OrderDetail', {
        sessionId: currentSession._id || currentSession.id,
        tableName: tableName,
        tableId: tableId,
        ratePerHour: ratePerHour
      });
    } else {
      // Hiển thị toast thông báo
      showToast('ℹ️ Chưa có món nào trong đơn', 'info');
    }
  }, [currentSession, navigation, tableName, tableId, ratePerHour]);

  // Sửa cart button để dùng toast
  const handleCartPress = () => {
    if (currentSession) {
      // Chuyển đến màn hình chi tiết đơn hàng
      navigation.navigate('OrderDetail', {
        sessionId: currentSession._id || currentSession.id,
        tableName: tableName,
        tableId: tableId
      });
    } else {
      // Hiển thị toast thông báo
      showToast('ℹ️ Chưa có món nào trong đơn', 'info');
    }
  };

  // Render product item với button add to cart
  const renderProductItem = (item) => {
    const productId = item._id || item.id;
    const isAdding = addingItem === productId;
    console.log('ITEM >>>', JSON.stringify(item, null, 2));
    console.log('IMAGES FIELD >>>', item.images);
    const imageUrl = getProductImageUrl(item);
    return (
      <View key={productId} style={styles.itemCard}>
        <Image
          source={{
            uri:
              imageUrl ||
              'https://via.placeholder.com/300x200.png?text=No+Image',
          }}
          style={styles.itemImage}
        />

        <View style={styles.priceContainer}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>
            {item.price.toLocaleString()}đ
            {item.unit && <Text style={styles.itemUnit}>/{item.unit}</Text>}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.buyButton,
            isAdding && styles.buyButtonDisabled
          ]}
          onPress={() => handleAddItem(item)}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buyButtonText}>Thêm</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategoryContent = () => {
    const items = menuData[selectedCategory] ?? [];

    if (categoryLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
        </View>
      );
    }

    if (!items || items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Không có sản phẩm nào</Text>
        </View>
      );
    }

    return (
      <View style={styles.itemsGrid}>
        {items.map(item => renderProductItem(item))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Header với thông tin bàn và session */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.tableInfo}>
          <Text style={styles.tableTitle}>{tableName || 'Đặt món'}</Text>
        </View>

        <TouchableOpacity
          style={styles.cartButton}
          onPress={handleCartPress} // Sử dụng function mới
        >
          <Ionicons name="receipt" size={24} color={currentSession ? "#333" : "#ccc"} />
          {currentSession?.items?.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {currentSession.items.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* Sidebar categories */}
        <View style={styles.sidebar}>
          {categories.map((category) => {
            const id = category._id || category.id;
            const isActive = selectedCategory === id;

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.categoryButton,
                  isActive && styles.selectedCategoryButton
                ]}
                onPress={() => setSelectedCategory(id)}
              >
                <View style={[
                  styles.categoryIcon,
                  isActive && styles.selectedCategoryIcon
                ]}>
                  {getCategoryIcon(category, isActive)}
                </View>

                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.selectedCategoryText
                  ]}
                  numberOfLines={2}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content area */}
        <View style={styles.contentArea}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {renderCategoryContent()}
          </ScrollView>
        </View>
      </View>

      {/* Footer tính tiền - chỉ hiện khi có session */}
      {currentSession && (
        <View style={styles.footer}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalText}>
              Thành tiền: {getTotalPrice().toLocaleString()}đ
            </Text>
            <Text style={styles.itemCount}>
              Mặt hàng: {getTotalItems()}
            </Text>
          </View>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Tiếp theo ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  tableInfo: {
    flex: 1,
    alignItems: 'center',
  },
  tableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sessionInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cartButton: {
    padding: 8,
    position: 'relative',
    borderRadius: 20,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 100,
    backgroundColor: '#e8e6f0',
    paddingVertical: 10,
  },
  categoryButton: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectedCategoryButton: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  selectedCategoryText: {
    color: '#111827',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f0f0f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
    backgroundColor: '#f0f0f0',
  },
  priceContainer: {
    padding: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  itemUnit: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
  },
  buyButton: {
    backgroundColor: '#4a5568',
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Footer styles
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  totalInfo: {
    flex: 1,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 15,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});