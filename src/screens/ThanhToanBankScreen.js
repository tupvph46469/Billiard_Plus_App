// src/screens/ThanhToanBankScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, Linking, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import payosService from '../services/payosService';
import vietqrService from '../services/vietqrService';
import socketService from '../services/socketService';
import api from '../services/api';

export default function ThanhToanBankScreen({ navigation, route }) {
  const { billId, need, billCode, tableName, autoNavigate = true } = route?.params || {};

  const [creating, setCreating] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null); // { paymentId, paymentLink, qrData, source, url, raw }
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // VietQR defaults (match server-side `ba.js` defaults)
  const VIETQR_BANK = 'MB';
  const VIETQR_ACCOUNT = '050598';
  const VIETQR_ACCOUNT_NAME = 'PHAM VAN TU';

  useEffect(() => {
    createQr();

    // If we have a billId, subscribe to real-time updates via Socket.IO
    if (billId) {
      try {
        socketService.connectSocket();
        socketService.subscribeToOrder(billId, async (data) => {
          console.log('Socket event order_paid for', billId, data);
          stopPolling();
          // Navigate to success screen
          try {
            await markBillPaid();
          } catch (e) {
            console.warn('Error handling socket order_paid', e);
          }
        });
      } catch (e) {
        console.warn('Socket connect failed, falling back to polling', e);
      }
    }

    return () => {
      stopPolling();
      if (billId) socketService.unsubscribeFromOrder(billId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paymentInfo?.attempts) {
      console.log('Payment attempt details:');
      paymentInfo.attempts.forEach((a, i) => {
        console.log(`${i + 1}. ${a.url} => ${a.ok ? 'OK' : (a.status || a.error || 'ERR')}`);
      });
    }
  }, [paymentInfo]);

  async function createQr() {
    try {
      setCreating(true);

      // Build transfer memo to embed in QR / payment description
      const transferMemo = `Thanh toán Billiard Plus tại ${tableName || ''}${(billCode || billId) ? ` - ${billCode || billId}` : ''}`;

      // 1) Try PayOS create
      try {
        const { data, url } = await payosService.createQrPayment({ amount: need, description: transferMemo, externalId: billId });
        
        const paymentId = data.id || data._id || data.transaction_id || data.payment_id || data.paymentId;
        const paymentLink = data.payment_link || data.deeplink || data.url || data.checkout_url || data.payment_url || (data.data && (data.data.checkoutUrl || data.data.paymentLink));
        const qrData = data.qr || data.qr_text || paymentLink || (data.data && (data.data.qr || data.data.qrCode || data.data.qrCodeUrl));

        if (paymentId || paymentLink || qrData) {
          const info = { source: 'payos', transferMemo, paymentId, paymentLink, qrData, raw: data, url };
          setPaymentInfo(info);
          startPollingPayment(info);
          return;
        }

        // If PayOS returned but no usable data, continue to VietQR
        console.warn('PayOS returned but no usable payment data', data, url);
      } catch (payErr) {
        console.warn('PayOS create failed:', payErr.message || payErr);
      }

      // 2) Fallback: VietQR service (try API then fallback to public image)
      const v = await vietqrService.createVietQr({ amount: need, addInfo: transferMemo, account: VIETQR_ACCOUNT, accountName: VIETQR_ACCOUNT_NAME, bank: VIETQR_BANK });
      const info = { source: v.source || 'vietqr', transferMemo, vietQrUrl: v.url, raw: v.raw || v, attempts: v.attempts };
      setPaymentInfo(info);

      // VietQR-based payments need us to poll backend for order/bill paid state
      startPollingPayment(info);

    } catch (err) {
      console.error('Create QR error', err);
      let msg = err?.message || 'Không thể tạo QR thanh toán.';
      if (err?.attempts) {
        const summary = err.attempts.map(a => `${a.url} => ${a.ok ? 'OK' : (a.status||a.error||'ERR')}`).join('\n');
        msg += '\nChi tiết thử:\n' + summary;
      }
      Alert.alert('Lỗi tạo QR', msg);
    } finally {
      setCreating(false);
    }
  }

  function startPollingPayment(info) {
    if (pollRef.current) return; // already polling
    setPolling(true);

    pollRef.current = setInterval(async () => {
      try {
        // 1) If payos info exists, check PayOS status
        if (info?.paymentId) {
          try {
            const statusData = await payosService.getPaymentStatus(info.paymentId);
            const status = statusData.status || statusData.state || (statusData.data && statusData.data.status);
            const s = String(status || '').toLowerCase();
            if (s === 'paid' || s === 'completed' || s === 'success' || statusData.paid === true) {
              await markBillPaid();
              return;
            }
          } catch (err) {
            // ignore and continue
          }
        }

        // 2) Check backend bill status (if your backend marks bill as paid when payment arrives)
        if (billId) {
          try {
            const res = await api.get(`/bills/${billId}`);
            const data = res.data;
            // Expect backend bill to have 'paid' flag or status
            if (data && (data.paid === true || data.status === 'PAID' || data.status === 'paid')) {
              await markBillPaid();
              return;
            }
          } catch (err) {
            // ignore
          }
        }

        // 3) Optionally, if vietQr used and you have a separate order service, you can call that to check addInfo-based matching

      } catch (err) {
        console.warn('Polling error', err);
      }
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setPolling(false);
    }
  }

  async function markBillPaid() {
    stopPolling();
    try {
      if (billId) {
        try {
          await api.patch(`/bills/${billId}/pay`, { paymentMethod: 'transfer' });
        } catch (err) {
          // ignore patch error, continue to success screen
          console.warn('Failed to patch bill as paid', err);
        }
      }

      navigation.replace('ThanhToanSuccess', {
        sessionId: 'completed',
        billId,
        billCode,
        tableName,
        need,
        paid: need,
        change: 0,
        shouldRefreshTables: true,
      });
    } catch (err) {
      console.error('markBillPaid error', err);
    }
  }

  // Link opening removed from UI — not needed in simplified layout

  const renderQr = () => {
    const q = paymentInfo?.qrData || paymentInfo?.paymentLink;

    if (q) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(q)}`;
      return (
        <View style={s.qrContainer}>
          <Image source={{ uri: qrUrl }} style={s.qrImage} />
        </View>
      );
    }

    if (paymentInfo?.vietQrUrl) {
      return (
        <View style={s.qrContainer}>
          <Image source={{ uri: paymentInfo.vietQrUrl }} style={s.qrImage} />
          <Text style={s.qrText}>{VIETQR_ACCOUNT_NAME} · {VIETQR_ACCOUNT}</Text>
          <Text style={s.amount}>{Number(need).toLocaleString('vi-VN')} VND</Text>
        </View>
      );
    }

    return (
      <View style={s.qrPlaceholder}>
        {creating ? <ActivityIndicator size="large" color="#1677FF" /> : <Text style={{ color: '#9CA3AF' }}>QR chưa sẵn sàng</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { stopPolling(); navigation.goBack(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Thanh toán chuyển khoản</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.container}>
        <View style={s.card}>
          <Text style={s.value}>{tableName}</Text>
          {renderQr()}
        </View>
        <TouchableOpacity
          style={s.successBtn}
          onPress={async () => { stopPolling(); await markBillPaid(); }}
          accessibilityRole="button"
        >
          <Text style={s.successText}>Đánh dấu đã thanh toán</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          onPress={async () => {
            // Manual check
            try {
              if (paymentInfo?.paymentId) {
                const s = await payosService.getPaymentStatus(paymentInfo.paymentId);
                Alert.alert('Kiểm tra', JSON.stringify(s).substring(0, 200));
              } else if (billId) {
                const r = await api.get(`/bills/${billId}`);
                Alert.alert('Kiểm tra hoá đơn', JSON.stringify(r.data).substring(0, 200));
              } else {
                Alert.alert('Kiểm tra', 'Không có thông tin để kiểm tra');
              }
            } catch (err) {
              Alert.alert('Lỗi kiểm tra', err?.message || String(err));
            }
          }}
          accessibilityRole="button"
        >
          <Text style={s.actionText}>Kiểm tra thanh toán</Text>
        </TouchableOpacity>

        <Text style={s.small}>{polling ? 'Đang kiểm tra thanh toán...' : 'Không kiểm tra tự động'}</Text>

        {/* Payment attempt details logged to console */}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 10), paddingBottom: 10, backgroundColor: '#F5F7FB' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  container: { padding: 16, alignItems: 'center' },

  // Card / info
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, alignItems: 'center' },
  value: { fontSize: 20, color: '#111827', fontWeight: '700' },

  qrContainer: { marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  qrImage: { width: 300, height: 300, borderRadius: 8, backgroundColor: '#fff' },
  qrText: { color: '#6B7280', marginTop: 8 },
  amount: { color: '#111827', marginTop: 4, fontWeight: '700' },
  transferMemo: { color: '#374151', marginTop: 8, textAlign: 'center', fontSize: 13 },
  qrPlaceholder: { width: 300, height: 300, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginTop: 12 },

  // Buttons
  primaryBtn: { marginTop: 16, backgroundColor: '#1677FF', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { backgroundColor: '#9CA3AF' },

  actionBtn: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center' },
  actionText: { color: '#374151', fontWeight: '700' },

  // Success button
  successBtn: { marginTop: 10, backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center' },
  successText: { color: '#ffffff', fontWeight: '700' },

  info: { fontSize: 14, color: '#374151' },
  linkLabel: { marginTop: 12, fontWeight: '600' },
  linkText: { color: '#2563eb', marginTop: 4, textAlign: 'center' },

  small: { color: '#6B7280', marginTop: 12 }
});
