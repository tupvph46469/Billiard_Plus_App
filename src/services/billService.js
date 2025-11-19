import api from "./api";
import { ENDPOINTS } from "../constants/config";

// Lấy danh sách hóa đơn
export const getBills = async () => {
  try {
    const res = await api.get(ENDPOINTS.bills);

    console.log("📌 RAW RES:", res.data);

    // Backend trả về { data: { items, ... }, ... }
    return res.data.data?.items;

  } catch (err) {
    console.log("❌ Lỗi getBills:", err.response?.data || err.message);
    throw err;
  }
};

// Lấy chi tiết hóa đơn
export const getBillDetail = async (billId) => {
  try {
    const res = await api.get(ENDPOINTS.billDetail(billId));

    // R.ok trả về { success: true, data: {...} }
    return res.data.data;

  } catch (err) {
    console.log("❌ Lỗi getBillDetail:", err.response?.data || err.message);
    throw err;
  }
};

export default {
  getBills,
  getBillDetail,
};