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
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { tableService } from '../services/tableService';
import { listAreas } from '../services/areaService';
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
  const [area, setArea] = useState('Đang tải...');
  const [showMenu, setShowMenu] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playingTime, setPlayingTime] = useState(0);
  const [productsData, setProductsData] = useState({});
  const [saving, setSaving] = useState(false);

  // Thêm states cho dialog hủy đơn
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  // Thêm states cho quantity operations
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // THÊM STATE MỚI ĐỂ TRACK THAY ĐỔI LOCAL
  const [localQuantityChanges, setLocalQuantityChanges] = useState({}); // { itemId: newQty }
  const [deletedItems, setDeletedItems] = useState(new Set()); // Set của các itemId đã xóa

  // Lấy params từ navigation
  const { sessionId, tableName, tableId, ratePerHour } = route?.params || {};

  // Danh sách lý do hủy đơn
  const cancelReasons = [
    'Đổi trả lại',
    'Thêm nhầm đơn hàng',
    'Khách báo hủy',
    'Lý do khác'
  ];

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
      console.log('💾 Đang lưu tất cả thay đổi...');
      setSaving(true);

      // 1. Áp dụng tất cả thay đổi số lượng
      const quantityPromises = Object.entries(localQuantityChanges).map(async ([itemId, newQty]) => {
        try {
          console.log(`📝 Cập nhật số lượng item ${itemId} thành ${newQty}`);
          await sessionService.updateItemQty(sessionId, itemId, { qty: newQty });
        } catch (error) {
          console.error(`❌ Lỗi cập nhật số lượng item ${itemId}:`, error);
          throw error;
        }
      });

      // 2. Xóa tất cả items đã đánh dấu xóa
      const deletePromises = Array.from(deletedItems).map(async (itemId) => {
        try {
          console.log(`🗑️ Xóa item ${itemId}`);
          await sessionService.removeItem(sessionId, itemId);
        } catch (error) {
          console.error(`❌ Lỗi xóa item ${itemId}:`, error);
          throw error;
        }
      });

      // 3. Thực hiện tất cả thay đổi song song
      await Promise.all([...quantityPromises, ...deletePromises]);

      // 4. Reset local changes
      setLocalQuantityChanges({});
      setDeletedItems(new Set());

      // 5. Reload session data để đồng bộ
      await loadSessionData();

      console.log('✅ Lưu tất cả thay đổi thành công');
      showToast('Lưu thành công');

      // 6. Chuyển màn hình
      navigation.navigate('Main', {
        screen: 'Table',
        params: { refreshData: true }
      });

    } catch (error) {
      console.error('❌ Lỗi khi lưu:', error);
      showToast('❌ Không thể lưu thông tin. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  }, [sessionId, localQuantityChanges, deletedItems, loadSessionData, navigation]);

  // Function handlePayment - CHUYỂN SANG THANH TOÁN (không dùng API checkout)
  const handlePayment = useCallback(async () => {
    try {
      console.log('💳 Navigating to payment screen...');

      // Chuyển sang màn thanh toán với thông tin session
      navigation.navigate('ThanhToan', {
        sessionId: sessionId,
        tableName: tableName,
        tableId: tableId,
        totalAmount: getTotalAmount(),
        playingTime: playingTime,
        ratePerHour: ratePerHour || sessionData?.pricingSnapshot?.ratePerHour || 40000,
        sessionData: sessionData
      });

    } catch (error) {
      console.error('❌ Error navigating to payment:', error);
      showToast('❌ Không thể chuyển đến màn thanh toán', 'error');
    }
  }, [sessionId, tableName, tableId, getTotalAmount, playingTime, ratePerHour, sessionData, navigation]);

  // Function handleMenuAction - XỬ LÝ CÁC ACTION TRONG MENU
  const handleMenuAction = useCallback(async (action) => {
    setShowMenu(false); // Đóng menu trước

    switch (action) {
      case 'Yêu cầu thanh toán':
        await handleCheckoutPayment();
        break;
      case 'Hủy đơn':
        setShowCancelDialog(true);
        break;
      case 'Thay đổi bàn': // Đây chính là đổi bàn
        navigation.navigate('ChooseTableScreen', {
          transferMode: true,
          sessionId: sessionId,
          currentTableName: tableName
        });
        break;
      default:
        showToast('Chức năng đang phát triển', 'info');
        break;
    }
  }, [sessionId, tableName, navigation]);

  // Function handleCheckoutPayment - SỬ DỤNG API CHECKOUT VÀ CHUYỂN TỚI PAYMENT SCREEN
  const handleCheckoutPayment = useCallback(async () => {
    try {
      console.log('💳 Creating bill via checkout API...');

      if (!sessionId) {
        showToast('❌ Không tìm thấy thông tin phiên chơi', 'error');
        return;
      }

      // Hiển thị loading
      setSaving(true);

      // Gọi API checkout để tạo bill và đóng session
      const checkoutResponse = await sessionService.checkout(sessionId, {
        endAt: new Date(),
        paymentMethod: 'cash', // Mặc định tiền mặt
        paid: false, // Chưa thanh toán, chỉ tạo bill
        note: 'Yêu cầu thanh toán từ menu'
      });

      console.log('✅ Bill created via checkout:', checkoutResponse);

      showToast('✅ Tạo hóa đơn thành công');

      // Chuyển tới Main tab với Payment screen
      navigation.navigate('Main', {
        screen: 'Payment',
        params: { refreshData: true }
      });

    } catch (error) {
      console.error('❌ Error creating bill via checkout:', error);

      let errorMessage = 'Không thể tạo hóa đơn';
      if (error.response?.status === 400) {
        errorMessage = 'Phiên chơi không hợp lệ';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy phiên chơi';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      showToast(`❌ ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [sessionId, navigation]);

  // Hàm tăng số lượng sản phẩm
  const handleIncreaseQuantity = useCallback(async (item) => {
    if (!item.sessionItemId) {
      console.error('❌ Không tìm thấy ID item trong session');
      showToast('❌ Không thể cập nhật số lượng', 'error');
      return;
    }

    console.log('⬆️ Tăng số lượng local cho item:', item.sessionItemId);
    
    // Tính số lượng hiện tại (có thể đã thay đổi local)
    const currentQty = localQuantityChanges[item.sessionItemId] ?? item.quantity;
    const newQty = currentQty + 1;
    
    // Cập nhật local state
    setLocalQuantityChanges(prev => ({
      ...prev,
      [item.sessionItemId]: newQty
    }));

    // Bỏ toast
  }, [localQuantityChanges]);

  // Hàm giảm số lượng sản phẩm
  const handleDecreaseQuantity = useCallback(async (item) => {
    if (!item.sessionItemId) {
      console.error('❌ Không tìm thấy ID item trong session');
      showToast('❌ Không thể cập nhật số lượng', 'error');
      return;
    }

    // Tính số lượng hiện tại (có thể đã thay đổi local)
    const currentQty = localQuantityChanges[item.sessionItemId] ?? item.quantity;
    
    // Nếu số lượng = 1, hiển thị dialog xác nhận xóa
    if (currentQty <= 1) {
      setItemToDelete(item);
      setShowDeleteDialog(true);
      return;
    }

    console.log('⬇️ Giảm số lượng local cho item:', item.sessionItemId);
    
    const newQty = currentQty - 1;
    
    // Cập nhật local state
    setLocalQuantityChanges(prev => ({
      ...prev,
      [item.sessionItemId]: newQty
    }));

    // Bỏ toast
  }, [localQuantityChanges]);

  // Hàm xóa sản phẩm
  const handleDeleteItem = useCallback(async (item) => {
    if (!item.sessionItemId) {
      console.error('❌ Không tìm thấy ID item trong session');
      showToast('❌ Không thể xóa sản phẩm', 'error');
      return;
    }

    console.log('🗑️ Đánh dấu xóa local item:', item.sessionItemId);

    // Thêm vào danh sách xóa
    setDeletedItems(prev => new Set([...prev, item.sessionItemId]));
    
    // Xóa khỏi quantity changes nếu có
    setLocalQuantityChanges(prev => {
      const newChanges = { ...prev };
      delete newChanges[item.sessionItemId];
      return newChanges;
    });

    // Đóng dialog
    setShowDeleteDialog(false);
    setItemToDelete(null);

    showToast('✅ Đã xóa sản phẩm (chưa lưu)');
  }, []);

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
    const hourlyRate = ratePerHour || sessionData?.pricingSnapshot?.ratePerHour || 40000;
    // Tính theo phút, sau đó chuyển về giờ (tỷ lệ chính xác)
    return Math.round((playingTime / 60) * hourlyRate);
  };

  // Tính tổng tiền F&B
  const getFoodTotal = () => {
    if (!sessionData?.items || sessionData.items.length === 0) {
      return 0;
    }

    return sessionData.items.reduce((total, item) => {
      // Bỏ qua nếu item đã bị xóa local
      if (deletedItems.has(item._id)) {
        return total;
      }

      const price = Number(item.priceSnapshot || 0);
      const qty = localQuantityChanges[item._id] ?? Number(item.qty || 0);
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
        // Bỏ qua nếu item đã bị xóa local
        if (deletedItems.has(item._id)) {
          return sum;
        }

        const qty = localQuantityChanges[item._id] ?? Number(item.qty || 0);
        return sum + qty;
      }, 0);
    }

    return total;
  };

  // Render item trong order với thiết kế riêng cho service items
  const renderOrderItem = (item, index) => {
    const shouldShowImage = item.type === 'food';
    let imageUrl = null;

    if (shouldShowImage && item.product) {
      const product = productsData[item.productId]; // Lấy từ cache
      imageUrl = getProductImageUrl(product);
      console.log(`🖼️ Item ${item.name}: product found=${!!product}, imageUrl=${imageUrl}`);
    }

    // Service items (Bida) có layout riêng
    if (item.type === 'service') {
      return (
        <View key={index} style={styles.serviceItem}>
          <View style={styles.serviceLeftSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="game-controller" size={24} color="#4a5568" />
            </View>
            <View style={styles.serviceNameContainer}>
              <Text style={styles.serviceName}>{item.name}</Text>
            </View>
          </View>
          
          <View style={styles.serviceRightSection}>
            <Text style={styles.servicePrice}>{item.price.toLocaleString()}đ</Text>
          </View>
        </View>
      );
    }

    // F&B items với quantity controls hoạt động
    return (
      <View key={index} style={styles.orderItem}>
        {/* LEFT SECTION: Image + Name */}
        <View style={styles.leftSection}>
          <Image
            source={{
              uri: imageUrl || 'https://i.imgur.com/placeholder.png'
            }}
            style={styles.itemImage}
          />

          <View style={styles.nameContainer}>
            <Text style={styles.itemName} numberOfLines={2} ellipsizeMode="tail">
              {item.name}
            </Text>
            {item.unit && (
              <Text style={styles.itemUnit}>Đơn vị: {item.unit}</Text>
            )}
          </View>
        </View>

        {/* CENTER SECTION: Quantity Controls */}
        <View style={styles.centerSection}>
          <View style={styles.quantityControls}>
            <TouchableOpacity 
              style={[
                styles.quantityButton,
                updatingQuantity && styles.quantityButtonDisabled
              ]}
              onPress={() => handleDecreaseQuantity(item)}
              disabled={updatingQuantity}
            >
              <Ionicons name="remove" size={20} color={updatingQuantity ? "#ccc" : "#666"} />
            </TouchableOpacity>
            
            <View style={styles.quantityDisplay}>
              {updatingQuantity ? (
                <ActivityIndicator size="small" color="#2c3e50" />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={[
                styles.quantityButton,
                updatingQuantity && styles.quantityButtonDisabled
              ]}
              onPress={() => handleIncreaseQuantity(item)}
              disabled={updatingQuantity}
            >
              <Ionicons name="add" size={20} color={updatingQuantity ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* RIGHT SECTION: Price */}
        <View style={styles.rightSection}>
          <Text style={styles.itemPrice}>{item.price.toLocaleString()}đ</Text>
        </View>
      </View>
    );
  };

  // Tạo danh sách items để hiển thị
  const getOrderItems = () => {
    const items = [];

    // 1. Tiền giờ chơi
    const playingFee = getPlayingFee();
    const displayHours = Math.floor(playingTime / 60);
    const displayMinutes = playingTime % 60;
    const timeDisplay = displayHours > 0
      ? `${displayHours}h${displayMinutes > 0 ? ` ${displayMinutes}m` : ''}`
      : `${displayMinutes}m`;

    items.push({
      id: 'playing_time',
      name: `Bida (${timeDisplay})`,
      price: playingFee,
      quantity: 1,
      type: 'service'
    });

    // 2. Các món F&B từ session với áp dụng thay đổi local
    if (sessionData?.items && sessionData.items.length > 0) {
      sessionData.items.forEach((sessionItem, index) => {
        // Bỏ qua nếu item đã bị xóa local
        if (deletedItems.has(sessionItem._id)) {
          return;
        }

        const product = productsData[sessionItem.product];
        
        // Lấy số lượng từ local changes hoặc từ session data
        const finalQuantity = localQuantityChanges[sessionItem._id] ?? Number(sessionItem.qty || 0);

        const orderItem = {
          id: `food_${index}`,
          name: sessionItem.nameSnapshot || 'Món ăn',
          price: Number(sessionItem.priceSnapshot || 0) * finalQuantity,
          quantity: finalQuantity,
          type: 'food',
          productId: sessionItem.product,
          sessionItemId: sessionItem._id,
          product: product,
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

  // Hàm xử lý hủy đơn
  const handleCancelOrder = async () => {
    if (!cancelReason) {
      showToast('Vui lòng chọn lý do hủy đơn', 'error');
      return;
    }

    if (cancelReason === 'Lý do khác' && !otherReason.trim()) {
      showToast('Vui lòng nhập lý do hủy đơn', 'error');
      return;
    }

    try {
      setSaving(true);

      const reason = cancelReason === 'Lý do khác' ? otherReason.trim() : cancelReason;

      console.log('🗑️ Canceling session:', sessionId, 'with reason:', reason);

      // Gọi API hủy phiên session
      await sessionService.void(sessionId, reason);

      console.log('✅ Session voided successfully');

      // Đóng dialog và reset state
      setShowCancelDialog(false);
      setCancelReason('');
      setOtherReason('');

      // Hiển thị thông báo thành công
      showToast('✅ Đã hủy đơn thành công');

      // Chuyển về màn hình danh sách bàn
      navigation.navigate('Main', {
        screen: 'Table',
        params: { refreshData: true }
      });

    } catch (error) {
      console.error('❌ Error canceling session:', error);

      let errorMessage = 'Không thể hủy đơn';
      if (error.response?.status === 400) {
        errorMessage = 'Phiên chơi không hợp lệ để hủy';
      } else if (error.response?.status === 403) {
        errorMessage = 'Bạn không có quyền hủy đơn';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy phiên chơi';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      showToast(`❌ ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Component dialog hủy đơn
  const CancelOrderDialog = () => (
    <Modal
      visible={showCancelDialog}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCancelDialog(false)}
    >
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogContainer}>
          <Text style={styles.dialogTitle}>Hủy đơn hàng</Text>

          <View style={styles.reasonsList}>
            {cancelReasons.map((reason, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reasonItem}
                onPress={() => setCancelReason(reason)}
              >
                <View style={[
                  styles.radioButton,
                  cancelReason === reason && styles.radioButtonSelected
                ]}>
                  {cancelReason === reason && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {cancelReason === 'Lý do khác' && (
            <View style={styles.otherReasonContainer}>
              <TextInput
                style={styles.otherReasonInput}
                placeholder="Nhập lý do hủy đơn..."
                value={otherReason}
                onChangeText={setOtherReason}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowCancelDialog(false);
                setCancelReason('');
                setOtherReason('');
              }}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleCancelOrder}
            >
              <Text style={styles.confirmButtonText}>Xác nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Dialog xác nhận xóa sản phẩm
  const DeleteConfirmDialog = () => (
    <Modal
      visible={showDeleteDialog}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setShowDeleteDialog(false);
        setItemToDelete(null);
      }}
    >
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogContainer}>
          <View style={styles.deleteDialogIcon}>
            <Ionicons name="trash" size={48} color="#ef4444" />
          </View>
          
          <Text style={styles.dialogTitle}>Xóa sản phẩm</Text>
          <Text style={styles.deleteDialogText}>
            Bạn có muốn xóa sản phẩm{'\n'}
            <Text style={styles.deleteDialogProductName}>"{itemToDelete?.name}"</Text>
            {'\n'}khỏi đơn hàng không?
          </Text>

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowDeleteDialog(false);
                setItemToDelete(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, styles.deleteConfirmButton]}
              onPress={() => handleDeleteItem(itemToDelete)}
              disabled={updatingQuantity}
            >
              {updatingQuantity ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Xóa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          onPress={handlePayment}
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
              'Tạo đơn mới trên bàn này',
              'Gộp đơn',
              'Hủy đơn',
              'Thay đổi bàn',
            ].map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => handleMenuAction(item)}
                disabled={saving}
              >
                <Text style={styles.menuText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Dialog hủy đơn */}
      <CancelOrderDialog />
      
      {/* Dialog xác nhận xóa sản phẩm */}
      <DeleteConfirmDialog />
    </SafeAreaView>
  );
}

// Styles với thêm styles cho dialog
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
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },

  // LEFT SECTION (40%)
  leftSection: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },

  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  nameContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },

  itemUnit: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },

  // CENTER SECTION (30%)
  centerSection: {
    flex: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e8f4f8',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },

  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafb',
    borderRadius: 14,
    margin: 2,
  },

  quantityButtonDisabled: {
    opacity: 0.5,
  },

  quantityDisplay: {
    minWidth: 44,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  quantityText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },

  serviceBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },

  serviceBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1565c0',
    textAlign: 'center',
  },

  // RIGHT SECTION (30%)
  rightSection: {
    flex: 0.3,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },

  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#27ae60',
    textAlign: 'right',
    lineHeight: 20,
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

  // Dialog styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },

  reasonsList: {
    marginBottom: 15,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  reasonText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },

  otherReasonContainer: {
    marginBottom: 20,
  },
  otherReasonInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
  },

  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Styles cho nút tăng/giảm số lượng
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  increaseButton: {
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  decreaseButton: {
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  quantityText: {
    fontSize: 14,
    color: '#333',
    paddingHorizontal: 8,
  },

  // Service badge cho các item dịch vụ (Bida)
  serviceBadge: {
    backgroundColor: '#e1f5fe',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    fontSize: 14,
    color: '#01579b',
    fontWeight: '500',
  },

  // Styles cho service item
  serviceItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },
  serviceLeftSection: {
    flex: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceNameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  serviceRightSection: {
    flex: 0.3,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#27ae60',
    textAlign: 'right',
    lineHeight: 20,
  },

  // Styles cho delete dialog
  deleteDialogIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },

  deleteDialogText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },

  deleteDialogProductName: {
    fontWeight: '600',
    color: '#111827',
  },

  deleteConfirmButton: {
    backgroundColor: '#ef4444',
  },
});
