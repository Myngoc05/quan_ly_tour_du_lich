const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { todayStr } = require('../utils');
const router = express.Router();
require('dotenv').config();

/*
 * GHI CHÚ TÍCH HỢP THANH TOÁN THẬT
 * ---------------------------------
 * Hiện tại luồng thanh toán đang được MÔ PHỎNG (không có tiền thật di chuyển).
 * Khi công ty có tài khoản merchant VNPay/Momo, hãy thay nội dung 2 hàm bên dưới:
 *
 * 1) createVNPayUrl(booking) -> tạo URL thanh toán VNPay thật:
 *    - Cần VNPAY_TMN_CODE, VNPAY_HASH_SECRET trong .env
 *    - Dùng thư viện hoặc code tạo chữ ký HMAC-SHA512 theo tài liệu:
 *      https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *    - Trả về returnUrl để redirect khách hàng sang trang thanh toán VNPay.
 *    - Tạo thêm route POST /vnpay-return để xử lý callback xác thực chữ ký
 *      và cập nhật booking sang trạng thái 'paid' + tạo hóa đơn.
 *
 * 2) createMomoUrl(booking) -> tương tự với Momo, dùng MOMO_PARTNER_CODE,
 *    MOMO_ACCESS_KEY, MOMO_SECRET_KEY theo tài liệu:
 *      https://developers.momo.vn/v3/docs/payment/api/wallet/onetime
 *
 * Trong cả hai trường hợp, KHÔNG đánh dấu đơn là 'paid' ở phía client —
 * chỉ đánh dấu đã thanh toán sau khi server xác thực chữ ký/callback từ
 * cổng thanh toán (IPN/webhook), để tránh gian lận giả mạo đã thanh toán.
 */

// Tạo mã thanh toán (hiện là QR mô phỏng) cho một phiếu đăng ký
router.post('/:bookingId/create-qr', requireAuth(['customer']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.bookingId);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (b.customer_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  if (b.status === 'paid') return res.status(400).json({ error: 'Đơn này đã được thanh toán.' });

  const payload = crypto.randomBytes(16).toString('hex');
  res.json({ qrPayload: payload, amount: b.total, bookingId: b.id, note: 'Đây là mã QR mô phỏng cho môi trường demo.' });
});

// Xác nhận đã thanh toán (mô phỏng quét QR thành công)
// Ràng buộc: sinh hóa đơn ngay, và nghiệp vụ gửi email hóa đơn trong vòng 24h (cần nối SMTP/dịch vụ email thật)
router.post('/:bookingId/confirm', requireAuth(['customer']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.bookingId);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (b.customer_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  if (b.status === 'paid') return res.status(400).json({ error: 'Đơn này đã được thanh toán trước đó.' });
  if (b.status === 'cancelled') return res.status(400).json({ error: 'Đơn này đã bị hủy, không thể thanh toán.' });

  const method = ['Ví điện tử', 'Thẻ ATM', 'Chuyển khoản', 'Tiền mặt'].includes(req.body.method) ? req.body.method : 'Ví điện tử';
  const employee = db.prepare('SELECT id FROM employees LIMIT 1').get();
  const invoiceId = 'HD' + Date.now().toString().slice(-8);
  const today = todayStr();

  const tx = db.transaction(() => {
    db.prepare("UPDATE bookings SET status='paid' WHERE id=?").run(b.id);
    db.prepare('INSERT INTO invoices (id,employee_id,booking_id,invoice_date,amount,payment_method) VALUES (?,?,?,?,?,?)')
      .run(invoiceId, employee ? employee.id : null, b.id, today, b.total, method);
  });
  tx();

  // TODO: gọi dịch vụ email thật ở đây (vd: Nodemailer + SMTP, hoặc Resend/SendGrid API)
  // để gửi hóa đơn cho khách hàng trong vòng 24 giờ theo quy định.

  res.json({
    message: 'Thanh toán thành công. Hóa đơn đã được lập, email xác nhận sẽ được gửi trong vòng 24 giờ.',
    invoiceId,
  });
});

module.exports = router;
