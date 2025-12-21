import api from "./api";

// Lấy thông tin tài khoản hiện tại
export const getMyProfile = () => {
  return api.get("/users/me");
};

// Cập nhật tài khoản
export const updateMyProfile = (id, data) => {
  return api.put(`/users/${id}`, data);
};
