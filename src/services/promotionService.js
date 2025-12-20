import api from './api';

export const promotionService = {
  // GET /api/v1/promotions - Danh sách khuyến mãi với filter
  list: async (params = {}) => {
    try {
      console.log('📋 [Promotion] Fetching promotions with params:', params);
      
      // Chuẩn hóa params theo schema validation
      const queryParams = {
        page: params.page || 1,
        limit: params.limit || 50,
        sort: params.sort || 'applyOrder',
        ...(params.q && { q: params.q }),
        ...(params.code && { code: params.code.toUpperCase() }),
        ...(params.scope && { scope: params.scope }),
        ...(params.active !== undefined && { active: params.active }),
        ...(params.at && { at: params.at }) // ISO date string
      };

      const response = await api.get('/promotions', { params: queryParams });
      console.log('✅ [Promotion] List success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] List error:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/v1/promotions/:id - Chi tiết khuyến mãi
  getById: async (promotionId) => {
    try {
      console.log('📋 [Promotion] Fetching promotion:', promotionId);
      const response = await api.get(`/promotions/${promotionId}`);
      console.log('✅ [Promotion] Get success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Get error:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/v1/promotions - Tạo khuyến mãi mới (Admin only)
  create: async (promotionData) => {
    try {
      console.log('➕ [Promotion] Creating promotion:', promotionData);
      
      // Validate required fields
      if (!promotionData.name || !promotionData.code || !promotionData.scope || !promotionData.discount) {
        throw new Error('Missing required fields: name, code, scope, discount');
      }

      const response = await api.post('/promotions', promotionData);
      console.log('✅ [Promotion] Create success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Create error:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/v1/promotions/:id - Cập nhật khuyến mãi (Admin only)
  update: async (promotionId, updateData) => {
    try {
      console.log('✏️ [Promotion] Updating promotion:', promotionId, updateData);
      const response = await api.put(`/promotions/${promotionId}`, updateData);
      console.log('✅ [Promotion] Update success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Update error:', error.response?.data || error.message);
      throw error;
    }
  },

  // PATCH /api/v1/promotions/:id/active - Bật/tắt khuyến mãi (Admin only)
  setActive: async (promotionId, active) => {
    try {
      console.log('🔄 [Promotion] Setting active:', promotionId, active);
      const response = await api.patch(`/promotions/${promotionId}/active`, { active });
      console.log('✅ [Promotion] Active change success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Active change error:', error.response?.data || error.message);
      throw error;
    }
  },

  // PATCH /api/v1/promotions/:id/apply-order - Thay đổi thứ tự áp dụng (Admin only)
  setApplyOrder: async (promotionId, applyOrder) => {
    try {
      console.log('🔄 [Promotion] Setting apply order:', promotionId, applyOrder);
      const response = await api.patch(`/promotions/${promotionId}/apply-order`, { applyOrder });
      console.log('✅ [Promotion] Apply order change success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Apply order change error:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/v1/promotions/:id - Xóa khuyến mãi (Admin only)
  remove: async (promotionId) => {
    try {
      console.log('🗑️ [Promotion] Removing promotion:', promotionId);
      const response = await api.delete(`/promotions/${promotionId}`);
      console.log('✅ [Promotion] Remove success:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [Promotion] Remove error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Helper methods cho business logic

  // Lấy promotions đang active tại thời điểm hiện tại
  getActivePromotions: async (checkTime = new Date()) => {
    try {
      return await promotionService.list({
        active: true,
        at: checkTime.toISOString(),
        sort: 'applyOrder' // Sắp xếp theo thứ tự ưu tiên
      });
    } catch (error) {
      console.error('❌ [Promotion] Error getting active promotions:', error);
      throw error;
    }
  },

  // Lấy promotions theo scope cụ thể
  getPromotionsByScope: async (scope, active = true) => {
    try {
      return await promotionService.list({
        scope,
        active,
        sort: 'applyOrder'
      });
    } catch (error) {
      console.error('❌ [Promotion] Error getting promotions by scope:', error);
      throw error;
    }
  },

  // Tìm kiếm promotions theo tên hoặc code
  searchPromotions: async (query, active = true) => {
    try {
      return await promotionService.list({
        q: query,
        active,
        sort: 'name'
      });
    } catch (error) {
      console.error('❌ [Promotion] Error searching promotions:', error);
      throw error;
    }
  },

  // Client-side validation helpers (optional)
  validatePromotionData: (promotionData) => {
    const errors = [];

    // Required fields
    if (!promotionData.name?.trim()) errors.push('Tên khuyến mãi là bắt buộc');
    if (!promotionData.code?.trim()) errors.push('Mã khuyến mãi là bắt buộc');
    if (!promotionData.scope) errors.push('Phạm vi áp dụng là bắt buộc');
    if (!promotionData.discount) errors.push('Thông tin giảm giá là bắt buộc');

    // Code format
    const codeRegex = /^[A-Z0-9_-]+$/;
    if (promotionData.code && !codeRegex.test(promotionData.code.toUpperCase())) {
      errors.push('Mã khuyến mãi chỉ chứa chữ cái, số, _ và -');
    }

    // Length limits
    if (promotionData.name && promotionData.name.length > 160) {
      errors.push('Tên khuyến mãi không được vượt quá 160 ký tự');
    }
    if (promotionData.code && promotionData.code.length > 32) {
      errors.push('Mã khuyến mãi không được vượt quá 32 ký tự');
    }

    // Enum validation
    const validScopes = ['time', 'product', 'bill'];
    if (promotionData.scope && !validScopes.includes(promotionData.scope)) {
      errors.push('Phạm vi áp dụng không hợp lệ');
    }

    return errors;
  },

  // Format helper cho time ranges
  formatTimeRange: (timeRange) => {
    if (!timeRange.from || !timeRange.to) return '';
    return `${timeRange.from} - ${timeRange.to}`;
  },

  // Format helper cho days of week
  formatDaysOfWeek: (daysOfWeek) => {
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return daysOfWeek.map(day => dayNames[day]).join(', ');
  },

  // Format helper cho discount
  formatDiscount: (discount) => {
    if (discount.type === 'percent') {
      const maxAmountText = discount.maxAmount 
        ? ` (tối đa ${discount.maxAmount.toLocaleString()}đ)` 
        : '';
      return `Giảm ${discount.value}%${maxAmountText}`;
    } else {
      return `Giảm ${discount.value.toLocaleString()}đ`;
    }
  }
};

export default promotionService;