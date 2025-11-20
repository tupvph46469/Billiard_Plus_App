import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  ToastAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { tableService } from '../services/tableService'; // Add import
import { listAreas } from '../services/areaService'; // Add import
import { CONFIG } from '../constants/config';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api'; // Import api để fetch products

// Hàm lấy URL hình ảnh sản phẩm
const BASE_URL = CONFIG.baseURL.replace(/\/$/, '');

function getProductImageUrl(product) {
  if (!product || !product.images || !Array.isArray(product.images) || product.images.length === 0) {
    return null;
  }
  
  const imagePath = product.images[0];
  if (!imagePath) return null;
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  } else if (imagePath.startsWith('/')) {
    return `${BASE_URL}${imagePath}`;
  } else {
    return `${BASE_URL}/${imagePath}`;
  }
}

// Custom Toast Component
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

export default function OrderDetail({ navigation, route }) {
  const [selectedTab, setSelectedTab] = useState('promotion');
  const [area, setArea] = useState('Đang tải...'); // Change initial state
  const [showMenu, setShowMenu] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playingTime, setPlayingTime] = useState(0);
  const [productsData, setProductsData] = useState({}); // Cache products data
  const [saving, setSaving] = useState(false); // Thêm state cho loading save

  // Lấy params từ navigation
  const { sessionId, tableName, tableId, ratePerHour } = route?.params || {};

  // Load area information for the table
  const loadAreaInfo = useCallback(async () => {
    try {
      if (tableId) {
        // Get table details
        const tableResponse = await tableService.getById(tableId);
        const table = tableResponse.data || tableResponse;
        
        if (table.areaId) {
          // Get areas list to find the area name
          const areasResponse = await listAreas();
          const areas = areasResponse.data?.data || areasResponse.data || areasResponse;
          
          const tableArea = areas.find(area => {
            const areaId = area._id || area.id;
            const tableAreaId = table.areaId._id || table.areaId.id || table.areaId;
            return String(areaId) === String(tableAreaId);
          });
          
          if (tableArea) {
            setArea(tableArea.name);
          } else {
            setArea('Chưa phân vùng');
          }
        } else {
          setArea('Chưa phân vùng');
        }
      }
    } catch (error) {
      console.error('Error loading area info:', error);
      setArea('Khu vực không xác định');
    }
  }, [tableId]);

  // Load session data từ API
  const loadSessionData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionService.getById(sessionId);
      const session = response.data || response;
      
      console.log('📋 Session loaded, product IDs:', session.items?.map(item => ({
        id: item.product,
        name: item.nameSnapshot
      })));
      
      setSessionData(session);
      
      // Tính thời gian chơi hiện tại
      if (session.startTime) {
        const startTime = new Date(session.startTime);
        const currentTime = new Date();
        const playingMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
        setPlayingTime(playingMinutes);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin phiên chơi');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Function handleSave - LƯU SESSION VÀ CHUYỂN VỀ TABLE LIST (với Toast)
  const handleSave = useCallback(async () => {
    try {
      console.log('💾 Saving session data...');
      setSaving(true);
      
      // Lưu thông tin session (refresh data để đồng bộ)
      await loadSessionData();
      
      console.log('✅ Session saved successfully');
      
      // Hiển thị toast thành công
      showToast('Lưu thành công');
      
      // Chuyển màn hình ngay lập tức
      console.log('🔄 Navigating back to Main Tab...');
      navigation.navigate('Main', {
        screen: 'Table',
        params: { refreshData: true }
      });
      
    } catch (error) {
      console.error('❌ Error saving session:', error);
      showToast('❌ Không thể lưu thông tin. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  }, [loadSessionData, navigation]);

  // Load session data và area info khi component mount
  useEffect(() => {
    const loadData = async () => {
      if (sessionId) {
        await loadSessionData();
      }
      if (tableId) {
        await loadAreaInfo();
      }
      if (!sessionId && !tableId) {
        setLoading(false);
      }
    };
    
    loadData();
  }, [sessionId, tableId]);

  // Load products data khi có session items
  useEffect(() => {
    if (sessionData?.items && sessionData.items.length > 0) {
      loadProductsData();
    }
  }, [sessionData]);

  // Tính thời gian chơi real-time
  useEffect(() => {
    let interval = null;
    
    if (sessionData && sessionData.startTime) {
      interval = setInterval(() => {
        const startTime = new Date(sessionData.startTime);
        const currentTime = new Date();
        const playingMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
        setPlayingTime(playingMinutes);
      }, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionData]);

  // Load products data cho các items trong session
  const loadProductsData = useCallback(async () => {
    try {
      const productIds = sessionData.items
        .map(item => item.product)
        .filter(Boolean); // Remove null/undefined

      if (productIds.length === 0) return;

      console.log('🔍 Fetching products:', productIds);

      // Fetch từng product - có thể optimize bằng batch API nếu backend support
      const productPromises = productIds.map(async (productId) => {
        try {
          const response = await api.get(`/products/${productId}`);
          return { id: productId, data: response.data.data || response.data };
        } catch (error) {
          console.error(`Error fetching product ${productId}:`, error);
          return { id: productId, data: null };
        }
      });

      const productResults = await Promise.all(productPromises);
      
      // Build products cache
      const productsCache = {};
      productResults.forEach(result => {
        if (result.data) {
          productsCache[result.id] = result.data;
        }
      });

      console.log('✅ Products loaded:', Object.keys(productsCache));
      setProductsData(productsCache);

    } catch (error) {
      console.error('Error loading products data:', error);
    }
  }, [sessionData]);

  // Tính tiền giờ chơi
  const getPlayingFee = () => {
    const hours = Math.ceil(playingTime / 60);
    const hourlyRate = ratePerHour || sessionData?.pricingSnapshot?.ratePerHour || 40000;
    return hours * hourlyRate;
  };

  // Tính tổng tiền F&B
  const getFoodTotal = () => {
    if (!sessionData?.items || sessionData.items.length === 0) {
      return 0;
    }
    
    return sessionData.items.reduce((total, item) => {
      const price = Number(item.priceSnapshot || 0);
      const qty = Number(item.qty || 0);
      return total + (price * qty);
    }, 0);
  };

  // Tính tổng tiền
  const getTotalAmount = () => {
    return getPlayingFee() + getFoodTotal();
  };

  // Tính tổng số lượng items
  const getTotalQuantity = () => {
    let total = 1; // Luôn có 1 cho tiền chơi
    
    if (sessionData?.items && sessionData.items.length > 0) {
      total += sessionData.items.reduce((sum, item) => {
        return sum + Number(item.qty || 0);
      }, 0);
    }
    
    return total;
  };

  // Render item trong order với hình ảnh
  const renderOrderItem = (item, index) => {
    const shouldShowImage = item.type === 'food';
    let imageUrl = null;
    
    if (shouldShowImage && item.product) {
      const product = productsData[item.productId]; // Lấy từ cache
      imageUrl = getProductImageUrl(product);
      console.log(`🖼️ Item ${item.name}: product found=${!!product}, imageUrl=${imageUrl}`);
    }
    
    return (
      <View key={index} style={styles.orderItem}>
        <View style={styles.itemInfo}>
          {shouldShowImage ? (
            <Image 
              source={{ 
                uri: imageUrl || 'https://i.imgur.com/placeholder.png' // Đổi placeholder
              }}
              style={styles.itemImage}
              onLoad={() => console.log(`🖼️ Image loaded: ${item.name}`)}
              onError={(error) => console.log(`🖼️ Image error: ${item.name}`, error.nativeEvent?.error)}
            />
          ) : (
            <View style={styles.iconContainer}>
              <Ionicons name="game-controller" size={20} color="#4a5568" />
            </View>
          )}
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.type === 'food' && item.unit && (
              <Text style={styles.itemUnit}>Đơn vị: {item.unit}</Text>
            )}
          </View>
          
          <Text style={styles.itemQuantity}>{item.quantity}</Text>
        </View>
        <Text style={styles.itemPrice}>{item.price.toLocaleString()}đ</Text>
      </View>
    );
  };

  // Tạo danh sách items để hiển thị
  const getOrderItems = () => {
    const items = [];
    
    // 1. Tiền giờ chơi
    const playingFee = getPlayingFee();
    const playingHours = Math.ceil(playingTime / 60);
    
    items.push({
      id: 'playing_time',
      name: `Bida (${playingHours}h${playingTime % 60 > 0 ? ` ${playingTime % 60}m` : ''})`,
      price: playingFee,
      quantity: 1,
      type: 'service'
    });

    // 2. Các món F&B từ session
    if (sessionData?.items && sessionData.items.length > 0) {
      sessionData.items.forEach((sessionItem, index) => {
        const product = productsData[sessionItem.product];
        
        const orderItem = {
          id: `food_${index}`,
          name: sessionItem.nameSnapshot || 'Món ăn',
          price: Number(sessionItem.priceSnapshot || 0) * Number(sessionItem.qty || 0),
          quantity: Number(sessionItem.qty || 0),
          type: 'food',
          productId: sessionItem.product, // ID để lookup trong cache
          product: product, // Product object từ cache
          unit: product?.unit || null
        };
        
        items.push(orderItem);
      });
    }

    return items;
  };

  const renderTabContent = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabContentText}>
        {selectedTab === 'promotion' && 'Chưa có khuyến mại nào được áp dụng'}
        {selectedTab === 'discount' && 'Chưa có chiết khấu nào được áp dụng'}
        {selectedTab === 'tax' && 'Thuế VAT: 0%'}
      </Text>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Nếu không có session data
  if (!sessionData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không tìm thấy thông tin phiên chơi</Text>
          <TouchableOpacity 
            style={styles.backButtonError} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonErrorText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const orderItems = getOrderItems();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {tableName || sessionData?.table?.name || 'Tạo hoá đơn'}
        </Text>

        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Dropdown */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity style={styles.dropdown}>
          <Text style={styles.dropdownText}>{area}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Order list */}
      <ScrollView style={styles.orderList}>
        {orderItems.map((item, index) => renderOrderItem(item, index))}
      </ScrollView>

      {/* Total Section */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>SL: {getTotalQuantity()}</Text>
        <Text style={styles.totalAmount}>
          Tổng: {getTotalAmount().toLocaleString()}đ
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'promotion' && styles.activeTab]}
          onPress={() => setSelectedTab('promotion')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'promotion' && styles.activeTabText]}
          >
            Khuyến mại
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'discount' && styles.activeTab]}
          onPress={() => setSelectedTab('discount')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'discount' && styles.activeTabText]}
          >
            Chiết khấu
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'tax' && styles.activeTab]}
          onPress={() => setSelectedTab('tax')}
        >
          <Text
            style={[styles.tabText, selectedTab === 'tax' && styles.activeTabText]}
          >
            Thuế & Phí
          </Text>
        </TouchableOpacity>
      </View>

      {renderTabContent()}

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => {
            navigation.navigate('OrderScreen', {
              tableId: tableId,
              tableName: tableName,
              ratePerHour: ratePerHour,
              sessionId: sessionId
            });
          }}
        >
          <Text style={styles.addButtonText}>+ Thêm</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#666" />
          ) : (
            <Text style={styles.saveButtonText}>Lưu</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.payButton}
          onPress={() => navigation.navigate('ThanhToan', {
            sessionId: sessionId,
            tableName: tableName,
            totalAmount: getTotalAmount()
          })}
        >
          <Text style={styles.payButtonText}>Thanh toán</Text>
        </TouchableOpacity>
      </View>

      {/* Menu overlay - unchanged */}
      {showMenu && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuBox}>
            {[
              'Yêu cầu thanh toán',
              'Lưu & in tạm tính', 
              'Lưu & in phiếu bếp',
              'In phiếu kiểm đồ',
              'Tạo đơn mới trên bàn này',
              'Gộp đơn',
              'Hủy đơn',
              'Thay đổi bàn',
              'Khách hàng',
            ].map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem}>
                <Text style={styles.menuText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// Styles với thêm style cho disabled button
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonError: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  backButtonErrorText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },

  sessionText: {
    fontSize: 14,
    color: '#333',
  },

  dropdownContainer: {
    backgroundColor: '#fff',
    padding: 12,
  },
  dropdown: {
    backgroundColor: '#f1f1f1',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: { flex: 1, fontSize: 14 },

  orderList: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  itemInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: { 
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemUnit: {
    fontSize: 12,
    color: '#666',
  },
  itemQuantity: {
    backgroundColor: '#e3f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '500',
  },
  itemPrice: { 
    fontSize: 16, 
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#2E7D32',
  },

  totalSection: {
    backgroundColor: '#e8f4ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  totalLabel: { color: '#666' },
  totalAmount: { fontWeight: 'bold' },

  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2196F3' },
  tabText: { color: '#777' },
  activeTabText: { color: '#2196F3', fontWeight: '600' },

  tabContent: {
    backgroundColor: '#fff',
    padding: 20,
    minHeight: 80,
  },
  tabContentText: {
    textAlign: 'center',
    color: '#777',
  },

  bottomButtons: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 10,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },

  saveButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: { fontWeight: '600' },

  payButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: '600' },

  /* MENU 3 CHẤM */
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  menuBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 20,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuText: { fontSize: 16, color: '#222' },
});
