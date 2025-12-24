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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { tableService } from '../services/tableService';
import { listAreas } from '../services/areaService';
import { promotionService } from '../services/promotionService'; // Thêm import promotionService
import { CONFIG } from '../constants/config';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

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
    Alert.alert('', message, [], { cancelable: true });
    setTimeout(() => {}, 2000);
  }
};

export default function OrderDetail({ navigation, route }) {
  // Thay đổi states cho promotion - bỏ dummy data
  const [availablePromotions, setAvailablePromotions] = useState([]);
  const [appliedPromotions, setAppliedPromotions] = useState([]);
  const [promotionLoading, setPromotionLoading] = useState(false);

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
  const [localQuantityChanges, setLocalQuantityChanges] = useState({});
  const [deletedItems, setDeletedItems] = useState(new Set());

  // Lấy params từ navigation
  const { sessionId, tableName, tableId, ratePerHour } = route?.params || {};

  // Danh sách lý do hủy đơn
  const cancelReasons = [
    'Đổi trả lại',
    'Thêm nhầm đơn hàng',
    'Khách báo hủy',
    'Lý do khác'
  ];

  // Load promotions từ API
  const loadPromotions = useCallback(async () => {
    try {
      console.log('🎁 Loading promotions...');
      setPromotionLoading(true);

      // Lấy promotions active tại thời điểm hiện tại
      const response = await promotionService.getActivePromotions();
      const promotions = response.data?.items || response.data || response || [];

      console.log('✅ Promotions loaded:', promotions.length);

      // Transform API data thành format hiển thị và kiểm tra điều kiện áp dụng
      const transformedPromotions = await Promise.all(
        promotions.map(async (promo) => {
          const applicable = await checkPromotionApplicability(promo);
          
          return {
            id: promo.id || promo._id,
            name: promo.name,
            code: promo.code,
            description: promo.description || generatePromotionDescription(promo),
            // SỬA: Chuẩn hóa discountType từ MongoDB
            discountType: promo.discount.type === 'percentage' ? 'percent' : 
                          promo.discount.type === 'fixed' ? 'value' : 
                          promo.discount.type,
            discountValue: promo.discount.value,
            applyTo: promo.discount.applyTo, // 'play' | 'service' | 'bill'
            maxAmount: promo.discount.maxAmount,
            scope: promo.scope, // 'time' | 'product' | 'bill'
            active: promo.active,
            // SỬA: Lấy từ conditions thay vì trực tiếp
            conditions: promo.conditions,
            timeRule: promo.conditions?.timeRules?.[0], // backward compatibility
            productRule: promo.conditions?.productRules?.[0],
            billRule: promo.conditions?.billRules?.[0],
            stackable: promo.stackable,
            applyOrder: promo.applyOrder,
            applicable: applicable,
            // Thêm createdAt để sắp xếp
            createdAt: promo.createdAt || promo.created_at
          };
        })
      );

      // Sắp xếp promotions: applicable lên đầu, sau đó sắp xếp theo createdAt
      const sortedPromotions = transformedPromotions.sort((a, b) => {
        // 1. Ưu tiên applicable lên đầu
        if (a.applicable && !b.applicable) return -1;
        if (!a.applicable && b.applicable) return 1;
        
        // 2. Nếu cùng trạng thái applicable, sắp xếp theo thời gian tạo (mới nhất lên đầu)
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Sort descending (newest first)
      });

      console.log('🔄 Promotions sorted:', sortedPromotions.map(p => ({ 
        code: p.code, 
        applicable: p.applicable, 
        createdAt: p.createdAt 
      })));

      setAvailablePromotions(sortedPromotions);

    } catch (error) {
      console.error('❌ Error loading promotions:', error);
      showToast('❌ Không thể tải khuyến mãi', 'error');
      setAvailablePromotions([]);
    } finally {
      setPromotionLoading(false);
    }
  }, [sessionData, playingTime]);

  // Kiểm tra promotion có thể áp dụng không
  const checkPromotionApplicability = useCallback(async (promotion) => {
    try {
      const now = new Date();

      // 1. Kiểm tra thời gian hiệu lực (đã được lọc trong getActivePromotions)
      
      // 2. Kiểm tra điều kiện theo scope
      switch (promotion.scope) {
        case 'time':
          return checkTimePromotionApplicability(promotion, now);
        
        case 'product':
          return checkProductPromotionApplicability(promotion);
        
        case 'bill':
          return checkBillPromotionApplicability(promotion);
        
        default:
          return false;
      }
    } catch (error) {
      console.error('❌ Error checking promotion applicability:', error);
      return false;
    }
  }, [sessionData, playingTime]);

  // Kiểm tra promotion time scope
  const checkTimePromotionApplicability = useCallback((promotion, checkTime) => {
    // Sửa: Lấy timeRules từ conditions (số nhiều)
    const timeRules = promotion.conditions?.timeRules;
    if (!timeRules || timeRules.length === 0) return false;

    const dayOfWeek = checkTime.getDay(); // 0=CN, 1=T2, ...
    const currentTime = `${String(checkTime.getHours()).padStart(2, '0')}:${String(checkTime.getMinutes()).padStart(2, '0')}`;

    // Kiểm tra xem có bất kỳ time rule nào phù hợp không
    const hasValidTimeRule = timeRules.some(timeRule => {
      // Kiểm tra ngày trong tuần
      if (timeRule.daysOfWeek && timeRule.daysOfWeek.length > 0) {
        if (!timeRule.daysOfWeek.includes(dayOfWeek)) {
          return false;
        }
      }

      // Kiểm tra khung giờ - Sửa: dùng startTime/endTime thay vì timeRanges
      if (timeRule.startTime && timeRule.endTime) {
        // Xử lý trường hợp qua đêm (startTime > endTime)
        if (timeRule.startTime > timeRule.endTime) {
          // Ví dụ: 22:00 - 06:00 (qua đêm)
          const isValid = currentTime >= timeRule.startTime || currentTime <= timeRule.endTime;
          if (!isValid) return false;
        } else {
          // Trường hợp bình thường: 08:00 - 16:00
          const isValid = currentTime >= timeRule.startTime && currentTime <= timeRule.endTime;
          if (!isValid) return false;
        }
      }

      // Kiểm tra thời gian chơi tối thiểu (nếu có)
      if (timeRule.minMinutes && playingTime < timeRule.minMinutes) {
        return false;
      }

      return true;
    });

    return hasValidTimeRule;
  }, [playingTime]);

  // Kiểm tra promotion product scope
  const checkProductPromotionApplicability = useCallback((promotion) => {
    const productRule = promotion.productRule;
    if (!productRule) return false;
    if (!sessionData?.items || sessionData.items.length === 0) return false;

    const sessionProducts = sessionData.items.map(item => item.product);

    // Kiểm tra sản phẩm cụ thể
    if (productRule.products && productRule.products.length > 0) {
      const hasMatchingProduct = productRule.products.some(productId =>
        sessionProducts.includes(productId)
      );
      if (hasMatchingProduct) return true;
    }

    // Kiểm tra combo
    if (productRule.combo && productRule.combo.length > 0) {
      return productRule.combo.every(comboItem => {
        const productInSession = sessionData.items.find(item => 
          item.product === comboItem.product
        );
        return productInSession && productInSession.qty >= comboItem.qty;
      });
    }

    // Kiểm tra danh mục (cần thêm logic nếu có category info)
    // TODO: Implement category check if needed

    return false;
  }, [sessionData]);

  // Kiểm tra promotion bill scope
  const checkBillPromotionApplicability = useCallback((promotion) => {
    const billRule = promotion.billRule;
    if (!billRule) return false;

    const currentTotal = getTotalAmount();
    const currentFoodTotal = getFoodTotal();

    // Kiểm tra tổng tiền tối thiểu
    if (billRule.minSubtotal && currentTotal < billRule.minSubtotal) {
      return false;
    }

    // Kiểm tra tiền dịch vụ tối thiểu
    if (billRule.minServiceAmount && currentFoodTotal < billRule.minServiceAmount) {
      return false;
    }

    // Kiểm tra thời gian chơi tối thiểu
    if (billRule.minPlayMinutes && playingTime < billRule.minPlayMinutes) {
      return false;
    }

    return true;
  }, [playingTime]);

  // Generate description nếu không có
  const generatePromotionDescription = useCallback((promotion) => {
    const discount = promotion.discount;
    let desc = '';

    if (discount.type === 'percent') {
      desc = `Giảm ${discount.value}% `;
    } else {
      desc = `Giảm ${discount.value.toLocaleString()}đ `;
    }

    switch (discount.applyTo) {
      case 'play':
        desc += 'tiền giờ chơi';
        break;
      case 'service':
        desc += 'dịch vụ F&B';
        break;
      case 'bill':
        desc += 'toàn hóa đơn';
        break;
    }

    if (discount.maxAmount) {
      desc += ` (tối đa ${discount.maxAmount.toLocaleString()}đ)`;
    }

    // Thêm điều kiện nếu có
    if (promotion.scope === 'time' && promotion.timeRule?.timeRanges?.length > 0) {
      const timeRange = promotion.timeRule.timeRanges[0];
      desc += ` từ ${timeRange.from}-${timeRange.to}`;
    }

    return desc;
  }, []);

  // Load area information for the table
  const loadAreaInfo = useCallback(async () => {
    try {
      if (tableId) {
        const tableResponse = await tableService.getById(tableId);
        const table = tableResponse.data || tableResponse;

        if (table.areaId) {
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

  // Load data khi component mount
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
  }, [sessionId, tableId, loadSessionData, loadAreaInfo]);

  // Load promotions khi có session data
  useEffect(() => {
    if (sessionData) {
      loadPromotions();
    }
  }, [sessionData, playingTime, loadPromotions]);

  // Load products data khi có session items
  useEffect(() => {
    if (sessionData?.items && sessionData.items.length > 0) {
      loadProductsData();
    }
  }, [sessionData]);

  // Tính thời gian chơi real-time và reload promotions
  useEffect(() => {
    let interval = null;

    if (sessionData && sessionData.startTime) {
      interval = setInterval(() => {
        const startTime = new Date(sessionData.startTime);
        const currentTime = new Date();
        const playingMinutes = Math.floor((currentTime - startTime) / (1000 * 60));
        setPlayingTime(playingMinutes);
        
        // Reload promotions để cập nhật tính khả dụng
        loadPromotions();
      }, 60000); // Mỗi phút
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionData, loadPromotions]);

  // Xử lý khi nhấn vào promotion
  const handlePromotionPress = useCallback((promotion) => {
    console.log('🎯 [Promotion Press] Starting promotion press:', promotion.code);
    console.log('🎯 [Promotion Press] Current applied promotions:', appliedPromotions.map(p => ({ code: p.code, stackable: p.stackable })));
    
    const isApplied = appliedPromotions.some(p => p.id === promotion.id);
    console.log('🎯 [Promotion Press] Is already applied?', isApplied);
    
    if (isApplied) {
      // Bỏ áp dụng promotion hiện tại
      console.log('🎯 [Promotion Press] Removing promotion:', promotion.code);
      setAppliedPromotions(prev => prev.filter(p => p.id !== promotion.id));
      showToast(`Đã bỏ khuyến mãi ${promotion.code}`);
      return;
    }
    
    if (!promotion.applicable) {
      console.log('🎯 [Promotion Press] Promotion not applicable:', promotion.code);
      showToast('Khuyến mãi này chưa đủ điều kiện áp dụng', 'error');
      return;
    }

    console.log('🎯 [Promotion Press] Promotion stackable?', promotion.stackable);

    // Nếu promotion mới KHÔNG stackable
    if (!promotion.stackable) {
      console.log('🎯 [Promotion Press] Non-stackable promotion - replacing all');
      setAppliedPromotions([promotion]);
      showToast(`Đã áp dụng khuyến mãi ${promotion.code}`);
      return;
    }

    // Nếu promotion mới CÓ THỂ stack
    console.log('🎯 [Promotion Press] Stackable promotion - checking existing promotions');
    
    // Kiểm tra xem có promotion nào KHÔNG stackable không
    const hasNonStackablePromotion = appliedPromotions.some(applied => !applied.stackable);
    console.log('🎯 [Promotion Press] Has non-stackable promotion?', hasNonStackablePromotion);
    
    if (hasNonStackablePromotion) {
      console.log('🎯 [Promotion Press] Has non-stackable - replacing all with new stackable');
      setAppliedPromotions([promotion]);
      showToast(`Đã thay thế và áp dụng khuyến mãi ${promotion.code}`);
      return;
    }

    // Tất cả promotions hiện tại đều stackable
    console.log('🎯 [Promotion Press] All current promotions are stackable');
    
    // Kiểm tra conflict về applyTo (chỉ khi cả hai đều có applyTo)
    const applyTo = promotion.discount?.applyTo;
    console.log('🎯 [Promotion Press] New promotion applyTo:', applyTo);
    
    if (applyTo) {
      const conflictPromotions = appliedPromotions.filter(applied => 
        applied.discount?.applyTo === applyTo
      );
      console.log('🎯 [Promotion Press] Conflict promotions:', conflictPromotions.map(p => p.code));
      
      if (conflictPromotions.length > 0) {
        console.log('🎯 [Promotion Press] Has applyTo conflict - replacing same type');
        const nonConflictPromotions = appliedPromotions.filter(applied => 
          applied.discount?.applyTo !== applyTo
        );
        const newPromotions = [...nonConflictPromotions, promotion];
        console.log('🎯 [Promotion Press] Setting promotions after conflict resolution:', newPromotions.map(p => p.code));
        setAppliedPromotions(newPromotions);
        showToast(`Đã thay thế khuyến mãi cùng loại bằng ${promotion.code}`);
        return;
      }
    }

    // Không có conflict → thêm vào danh sách
    console.log('🎯 [Promotion Press] No conflict - adding to list');
    const newPromotions = [...appliedPromotions, promotion];
    console.log('🎯 [Promotion Press] Final promotions list:', newPromotions.map(p => p.code));
    setAppliedPromotions(newPromotions);
    showToast(`Đã áp dụng khuyến mãi ${promotion.code}`);
  }, [appliedPromotions]);

  // Render promotion item trong horizontal scroll - SỬA: Compact hơn
  const renderPromotionItem = ({ item }) => {
    const isApplied = appliedPromotions.some(p => p.id === item.id);
    const canApply = item.applicable && !isApplied;

    return (
      <TouchableOpacity
        style={[
          styles.promotionCard,
          isApplied && styles.promotionCardApplied,
          !item.applicable && styles.promotionCardDisabled
        ]}
        onPress={() => handlePromotionPress(item)}
        disabled={!canApply && !isApplied}
      >
        {/* Header với mã và trạng thái */}
        <View style={styles.promotionHeader}>
          <Text style={[
            styles.promotionCode,
            isApplied && styles.promotionCodeApplied
          ]}>
            {item.code}
          </Text>
          
          {isApplied && (
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          )}
        </View>

        {/* Tên promotion */}
        <Text style={[
          styles.promotionName,
          !item.applicable && styles.promotionNameDisabled
        ]} numberOfLines={1}>
          {item.name}
        </Text>

        {/* Footer với loại giảm giá */}
        <View style={styles.promotionFooter}>
          <Text style={[
            styles.discountText,
            !item.applicable && styles.discountTextDisabled
          ]}>
            {item.discountType === 'percent' 
              ? `Giảm ${item.discountValue}%` 
              : `Giảm ${item.discountValue.toLocaleString()}đ`
            }
          </Text>

          {!item.applicable && !isApplied && (
            <Text style={styles.notApplicableText}>Chưa đủ điều kiện</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Sửa lại renderPromotionContent để compact hơn
  const renderPromotionContent = () => (
    <View style={styles.promotionSection}>
      <View style={styles.promotionSectionHeader}>
        <Text style={styles.promotionSectionTitle}>
          Khuyến mãi ({availablePromotions.filter(p => p.applicable).length})
        </Text>
      </View>
      
      {promotionLoading ? (
        <View style={styles.promotionLoadingContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.promotionLoadingText}>Đang tải...</Text>
        </View>
      ) : availablePromotions.length > 0 ? (
        <FlatList
          data={availablePromotions}
          renderItem={renderPromotionItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promotionList}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        />
      ) : (
        <View style={styles.noPromotionContainer}>
          <Text style={styles.noPromotionText}>Không có khuyến mãi</Text>
        </View>
      )}
    </View>
  );

  // Tính tổng tiền với promotion
  const getTotalAmountWithPromotions = () => {
    let total = getTotalAmount();
    let totalDiscount = 0;

    // Áp dụng promotions theo thứ tự priority
    const sortedPromotions = [...appliedPromotions].sort((a, b) => a.applyOrder - b.applyOrder);

    sortedPromotions.forEach(promotion => {
      let discount = 0;
      const baseAmount = promotion.applyTo === 'play' ? getPlayingFee() : 
                       promotion.applyTo === 'service' ? getFoodTotal() : total;

      if (promotion.discountType === 'percent') {
        discount = Math.round(baseAmount * promotion.discountValue / 100);
        if (promotion.maxAmount && discount > promotion.maxAmount) {
          discount = promotion.maxAmount;
        }
      } else {
        discount = promotion.discountValue;
      }

      totalDiscount += discount;
    });

    return Math.max(0, total - totalDiscount);
  };

  // Tính tổng discount
  const getTotalDiscount = () => {
    return getTotalAmount() - getTotalAmountWithPromotions();
  };

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
        totalAmount: getTotalAmountWithPromotions(), // ✅ SỬA: Dùng tổng tiền đã áp dụng promotion
        originalAmount: getTotalAmount(), // ✅ THÊM: Tổng tiền gốc để tham khảo
        discount: getTotalDiscount(), // ✅ THÊM: Số tiền giảm giá
        appliedPromotions: appliedPromotions, // ✅ THÊM: Danh sách promotion đã áp dụng
        playingTime: playingTime,
        ratePerHour: ratePerHour || sessionData?.pricingSnapshot?.ratePerHour || 40000,
        sessionData: sessionData
      });

    } catch (error) {
      console.error('❌ Error navigating to payment:', error);
      showToast('❌ Không thể chuyển đến màn thanh toán', 'error');
    }
  }, [sessionId, tableName, tableId, getTotalAmountWithPromotions, getTotalAmount, getTotalDiscount, appliedPromotions, playingTime, ratePerHour, sessionData, navigation]);

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

  // Function handleCheckoutPayment - SỬA LẠI VỚI DEBUG CHI TIẾT HỚN
  const handleCheckoutPayment = useCallback(async () => {
    try {
      console.log('💳 [OrderDetail] ===== YÊU CẦU THANH TOÁN =====');

      if (!sessionId) {
        showToast('❌ Không tìm thấy thông tin phiên chơi', 'error');
        return;
      }

      setSaving(true);

      // ✅ THÊM: Debug chi tiết về state promotion
      console.log('🎯 [OrderDetail] ===== PROMOTION STATE DEBUG =====');
      console.log('🎯 [OrderDetail] appliedPromotions:', appliedPromotions);
      console.log('🎯 [OrderDetail] appliedPromotions type:', typeof appliedPromotions);
      console.log('🎯 [OrderDetail] appliedPromotions length:', appliedPromotions?.length);
      console.log('🎯 [OrderDetail] appliedPromotions JSON:', JSON.stringify(appliedPromotions, null, 2));
      
      // ✅ THÊM: Debug functions tính toán
      const originalTotal = getTotalAmount();
      const totalWithPromotions = getTotalAmountWithPromotions();
      const discountAmount = getTotalDiscount();
      
      console.log('🎯 [OrderDetail] ===== CALCULATION DEBUG =====');
      console.log('🎯 [OrderDetail] Original total:', originalTotal);
      console.log('🎯 [OrderDetail] Total with promotions:', totalWithPromotions);
      console.log('🎯 [OrderDetail] Discount amount:', discountAmount);
      console.log('🎯 [OrderDetail] Session ID:', sessionId);

      // ✅ SỬA: Kiểm tra promotion bằng cách check cả discount amount
      const hasPromotions = appliedPromotions && appliedPromotions.length > 0;
      const hasDiscount = discountAmount > 0;
      
      console.log('🎯 [OrderDetail] Has promotions (state):', hasPromotions);
      console.log('🎯 [OrderDetail] Has discount (calculated):', hasDiscount);
      
      // Nếu có discount nhưng không có promotions trong state -> có lỗi về state
      if (hasDiscount && !hasPromotions) {
        console.warn('⚠️ [OrderDetail] INCONSISTENCY: Có discount nhưng không có promotions trong state!');
        console.warn('⚠️ [OrderDetail] This indicates a state synchronization issue');
        
        // Thử lấy lại thông tin promotions từ UI state
        showToast('⚠️ Có lỗi đồng bộ dữ liệu khuyến mãi. Đang thử tạo bill với số tiền hiện tại...', 'warning');
      }
      
      // ✅ SỬA: Nếu KHÔNG có discount thực tế thì tạo bill thông thường
      if (!hasDiscount) {
        console.log('⚠️ [OrderDetail] No actual discount, creating bill with original amount');
        
        const checkoutPayload = {
          endAt: new Date(),
          discountLines: [],
          surcharge: 0,
          paymentMethod: 'cash',
          paid: false,
          note: 'Yêu cầu thanh toán từ menu - không có khuyến mãi'
        };

        console.log('📤 [OrderDetail] Simple payload (no promotions):', JSON.stringify(checkoutPayload, null, 2));

        const checkoutResponse = await sessionService.checkout(sessionId, checkoutPayload);
        
        const createdBill = checkoutResponse.data?.bill || checkoutResponse.data || checkoutResponse;
        const billTotal = createdBill.total;

        console.log('💰 [OrderDetail] Created bill total:', billTotal);
        console.log('💰 [OrderDetail] Expected total (original):', originalTotal);

        showToast('✅ Tạo hóa đơn thành công');
        navigation.navigate('Main', {
          screen: 'Payment',
          params: { refreshData: true }
        });
        return;
      }

      // ✅ CÓ DISCOUNT - Tạo bill với promotion dựa trên calculation thay vì state
      console.log('🎁 [OrderDetail] ===== HAS DISCOUNT - CREATING DISCOUNTED BILL =====');
      
      // Nếu có promotions trong state, dùng nó
      let discountLines = [];
      
      if (hasPromotions) {
        console.log('🎁 [OrderDetail] Using promotions from state');
        appliedPromotions.forEach(promotion => {
          console.log('🎁 [OrderDetail] Processing promotion:', {
            name: promotion.name,
            code: promotion.code,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue
          });

          const discountLine = {
            name: `${promotion.name} (${promotion.code})`,
            type: promotion.discountType === 'percent' ? 'percent' : 'value',
            value: promotion.discountValue,
            amount: promotion.discountType === 'percent' 
              ? Math.min((originalTotal * promotion.discountValue) / 100, promotion.maxAmount || Infinity)
              : promotion.discountValue,
            meta: {
              promotionId: promotion.id,
              code: promotion.code,
              applyTo: promotion.applyTo,
              maxAmount: promotion.maxAmount,
              stackable: promotion.stackable
            }
          };
          
          console.log('🎁 [OrderDetail - DiscountLine]:', JSON.stringify(discountLine, null, 2));
          discountLines.push(discountLine);
        });
      } else {
        // Fallback: Tạo discount line generic dựa trên discount amount
        console.log('🎁 [OrderDetail] No promotions in state, creating generic discount line');
        discountLines = [{
          name: 'Khuyến mãi đã áp dụng',
          type: 'value',
          value: discountAmount,
          amount: discountAmount,
          meta: {
            source: 'calculated',
            note: 'Recovered from UI calculation'
          }
        }];
      }

      const checkoutPayload = {
        endAt: new Date(),
        discountLines: discountLines,
        surcharge: 0,
        paymentMethod: 'cash',
        paid: false,
        note: hasPromotions 
          ? `Yêu cầu thanh toán - Áp dụng KM: ${appliedPromotions.map(p => p.code).join(', ')}`
          : `Yêu cầu thanh toán - Giảm giá: ${discountAmount.toLocaleString()}đ`
      };

      console.log('📤 [OrderDetail] Checkout payload with discounts:', JSON.stringify(checkoutPayload, null, 2));

      const checkoutResponse = await sessionService.checkout(sessionId, checkoutPayload);
      
      console.log('📥 [OrderDetail] Checkout response:', JSON.stringify(checkoutResponse, null, 2));

      const createdBill = checkoutResponse.data?.bill || checkoutResponse.data || checkoutResponse;
      const billId = createdBill._id || createdBill.id;
      const billTotal = createdBill.total;
      const billDiscounts = createdBill.discounts || [];

      console.log('💰 [OrderDetail] Created bill ID:', billId);
      console.log('💰 [OrderDetail] Created bill total:', billTotal);
      console.log('💰 [OrderDetail] Bill discounts:', billDiscounts);
      console.log('💰 [OrderDetail] Expected total:', totalWithPromotions);

      // Validation kết quả
      if (billDiscounts.length > 0) {
        console.log('✅ [OrderDetail] Backend applied discounts successfully!');
        showToast(`✅ Áp dụng khuyến mãi thành công - Tiết kiệm ${discountAmount.toLocaleString()}đ`);
      } else {
        console.warn('⚠️ [OrderDetail] Expected discounts but none found in bill');
        showToast('⚠️ Có vấn đề với khuyến mãi, kiểm tra backend logs');
      }

      if (Math.abs(billTotal - totalWithPromotions) < 1000) {
        console.log('✅ [OrderDetail] Total matches expected amount!');
        showToast('✅ Tạo hóa đơn thành công với khuyến mãi đã áp dụng');
      } else {
        console.warn('⚠️ [OrderDetail] Total mismatch');
        console.warn('⚠️ [OrderDetail] Backend:', billTotal, '- Expected:', totalWithPromotions);
        showToast(`⚠️ Bill: ${billTotal.toLocaleString()}đ, Mong đợi: ${totalWithPromotions.toLocaleString()}đ`);
      }

      navigation.navigate('Main', {
        screen: 'Payment',
        params: { refreshData: true }
      });

    } catch (error) {
      console.error('❌ [OrderDetail] Error creating bill:', error);
      console.error('❌ [OrderDetail] Error response:', error.response?.data);
      
      let errorMessage = 'Có lỗi xảy ra khi tạo hóa đơn';
      if (error.response?.status === 400) {
        errorMessage = 'Thông tin không hợp lệ';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy phiên chơi';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showToast(`❌ ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [sessionId, getTotalAmountWithPromotions, getTotalAmount, getTotalDiscount, appliedPromotions, navigation]);

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
        // Bỏ qua nếu item đã bị xóa
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

      {/* Total Section với Promotions */}
      <View style={styles.totalSection}>
        <View style={styles.totalLeftSection}>
          <Text style={styles.totalLabel}>SL: {getTotalQuantity()}</Text>
          {getTotalDiscount() > 0 && (
            <Text style={styles.discountLabel}>
              Giảm: -{getTotalDiscount().toLocaleString()}đ
            </Text>
          )}
        </View>
        <View style={styles.totalRightSection}>
          {getTotalDiscount() > 0 && (
            <Text style={styles.originalAmount}>
              {getTotalAmount().toLocaleString()}đ
            </Text>
          )}
          <Text style={styles.totalAmount}>
            Tổng: {getTotalAmountWithPromotions().toLocaleString()}đ
          </Text>
        </View>
      </View>

      {/* Tabs - chỉ còn Khuyến mại */}
      <View style={styles.bottomTabs}>
        <View style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>
            Khuyến mại
          </Text>
        </View>
      </View>

      {/* Promotion Content */}
      {renderPromotionContent()}

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

      {/* Menu và Dialogs giữ nguyên */}
      {showMenu && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuBox}>
            {[
              'Yêu cầu thanh toán',
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

  // CENTER SECTION: Quantity Controls
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
  totalLeftSection: {
    flex: 1,
  },
  totalRightSection: {
    alignItems: 'flex-end',
  },
  totalLabel: { 
    color: '#666',
    fontSize: 14,
  },
  discountLabel: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  originalAmount: {
    fontSize: 14,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  totalAmount: { 
    fontWeight: 'bold',
    fontSize: 16,
    color: '#111827',
  },

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
  activeTab: { 
    borderBottomColor: '#2196F3' 
  },
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

  // Thêm styles mới cho promotion cards
  // Cập nhật tab styles
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { 
    borderBottomColor: '#2196F3' 
  },

  // Thêm styles cho promotion section
  promotionSection: {
    backgroundColor: '#fff',
    paddingVertical: 12, // Giảm từ 16
    minHeight: 100, // Giảm từ 160
  },

  promotionSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 8, // Giảm từ 12
  },

  promotionSectionTitle: {
    fontSize: 14, // Giảm từ 16
    fontWeight: '600',
    color: '#111827',
  },

  promotionList: {
    paddingHorizontal: 16,
  },

  promotionCard: {
    backgroundColor: '#fff',
    borderRadius: 8, // Giảm từ 12
    padding: 10, // Giảm từ 16
    width: 160, // Giảm từ 280
    borderWidth: 1, // Giảm từ 2
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1, // Giảm từ 2
    },
    shadowOpacity: 0.05, // Giảm từ 0.1
    shadowRadius: 2, // Giảm từ 3
    elevation: 2, // Giảm từ 3
  },

  promotionCardApplied: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },

  promotionCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },

  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6, // Giảm từ 8
  },

  promotionCode: {
    fontSize: 11, // Giảm từ 12
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6, // Giảm từ 8
    paddingVertical: 2, // Giảm từ 4
    borderRadius: 4, // Giảm từ 6
    letterSpacing: 0.3,
  },

  promotionCodeApplied: {
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
  },

  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  appliedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#22c55e',
  },

  promotionName: {
    fontSize: 13, // Giảm từ 16
    fontWeight: '500', // Giảm từ 600
    color: '#111827',
    marginBottom: 6,
  },

  promotionNameDisabled: {
    color: '#9ca3af',
  },

  promotionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  discountText: {
    fontSize: 14, // Giảm từ 15
    fontWeight: '700',
    color: '#dc2626',
  },

  discountTextDisabled: {
    color: '#9ca3af',
  },

  notApplicableText: {
    fontSize: 10, // Giảm từ 11
    fontWeight: '500',
    color: '#dc2626',
  },

  noPromotionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20, // Giảm từ 32
  },

  noPromotionText: {
    fontSize: 14, // Giảm từ 16
    color: '#9ca3af',
  },

  // Thêm styles cho promotion loading
  promotionLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20, // Giảm từ 32
  },

  promotionLoadingText: {
    marginLeft: 6, // Giảm từ 8
    fontSize: 13, // Giảm từ 14
    color: '#6b7280',
  },
});
