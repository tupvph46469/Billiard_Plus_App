// services/billService.js
import api from "./api";

export const getBills = async () => {
  const res = await api.get("/bills");
  // backend trả về structure như Postman: res.data.data.items
  return res.data?.data?.items || [];
};
