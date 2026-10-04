const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { todayStr, daysBetween } = require('../utils');
const router = express.Router();

// Khách hàng gửi yêu cầu đổi tour
// Ràng buộc: trong vòng 5 ngày sau khi đặt VÀ trước 7 ngày so với ngày khởi hành tour mới; chỉ 1 lần/đơn
// Ràng buộc bối cảnh: chỉ áp dụng cho đơn ĐÃ THANH TOÁN (đơn chưa thanh toán không có nhu cầu đổi theo mô tả nghiệp vụ)
router.post('/', requireAuth(['customer']), (req, res) => {
  const { bookingId, newTourId } = req.body;
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (b.customer_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  if (b.status !== 'paid') return res.status(400).json({ error: 'Chỉ có thể yêu cầu đổi tour đối với đơn đã thanh toán.' });
  if (b.changed) return res.status(400).json({ error: 'Đơn này đã đổi tour một lần, không thể đổi thêm.' });

  const today = todayStr();
  if (daysBetween(b.booking_date, today) > 5) {
    return res.status(400).json({ error: 'Đã quá 5 ngày kể từ khi đặt tour, không thể đổi.' });
  }
  const newTour = db.prepare('SELECT * FROM tours WHERE id=?').get(newTourId);
  if (!newTour) return res.status(404).json({ error: 'Không tìm thấy tour mới.' });
  if (daysBetween(today, newTour.depart_date) < 7) {
    return res.status(400).json({ error: 'Ngày khởi hành tour mới quá gần (dưới 7 ngày), không thể đổi.' });
  }

  const invoice = db.prepare('SELECT id FROM invoices WHERE booking_id=?').get(b.id);
  const id = 'PD' + Date.now().toString().slice(-8);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO change_requests (id,invoice_id,customer_id,change_date,old_tour_id,new_tour_id) VALUES (?,?,?,?,?,?)')
      .run(id, invoice ? invoice.id : null, b.customer_id, today, b.tour_id, newTourId);
    db.prepare('UPDATE bookings SET tour_id=?, changed=1 WHERE id=?').run(newTourId, b.id);
  });
  tx();

  // TODO: gửi email xác nhận đổi tour cho khách hàng qua dịch vụ email thật ở đây.

  res.json({ message: 'Đổi tour thành công. Email xác nhận sẽ được gửi cho bạn.', changeRequestId: id });
});

// Danh sách phiếu đổi tour — nhân viên
router.get('/', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT * FROM change_requests ORDER BY change_date DESC').all());
});

module.exports = router;
