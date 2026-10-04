const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { todayStr, daysBetween } = require('../utils');
const router = express.Router();

function withDetails(b) {
  const tour = db.prepare('SELECT * FROM tours WHERE id=?').get(b.tour_id);
  const cust = db.prepare('SELECT id,name,email,phone,cccd FROM customers WHERE id=?').get(b.customer_id);
  return { ...b, tour, customer: cust };
}

// Khách hàng tạo phiếu đăng ký tour
// Ràng buộc bắt buộc: ngày khởi hành phải cách hôm nay tối thiểu 15 ngày; số lượng người <= số chỗ còn trống
router.post('/', requireAuth(['customer']), (req, res) => {
  const { tourId, adults, children, vehicle, hotel, departDate } = req.body;
  const tour = db.prepare('SELECT * FROM tours WHERE id=?').get(tourId);
  if (!tour) return res.status(404).json({ error: 'Không tìm thấy tour.' });

  const today = todayStr();
  if (daysBetween(today, departDate) < 15) {
    return res.status(400).json({ error: 'Không thể đặt tour: ngày khởi hành phải cách ngày đăng ký tối thiểu 15 ngày.' });
  }
  const a = Number(adults) || 0, c = Number(children) || 0;
  if (a < 1) return res.status(400).json({ error: 'Cần tối thiểu 1 người lớn.' });
  const qty = a + c;
  if (qty > tour.seats) return res.status(400).json({ error: `Tour chỉ còn ${tour.seats} chỗ, vượt quá số lượng đăng ký.` });

  const id = 'PDK' + Date.now().toString().slice(-8);
  const total = qty * tour.cost;
  db.prepare(`INSERT INTO bookings (id,booking_date,customer_id,tour_id,qty,adults,children,vehicle,hotel,depart_date,depart_time,total,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'wait')`)
    .run(id, today, req.user.id, tourId, qty, a, c, vehicle || '', hotel || '', departDate, '06:00', total);
  db.prepare('UPDATE tours SET seats = seats - ? WHERE id=?').run(qty, tourId);

  res.status(201).json(withDetails(db.prepare('SELECT * FROM bookings WHERE id=?').get(id)));
});

// Đơn của khách hàng đang đăng nhập
router.get('/mine', requireAuth(['customer']), (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings WHERE customer_id=? ORDER BY booking_date DESC').all(req.user.id);
  res.json(rows.map(withDetails));
});

router.get('/:id', requireAuth(['customer', 'employee']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.user.role === 'customer' && b.customer_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền xem đơn này.' });
  res.json(withDetails(b));
});

// Toàn bộ booking — dành cho nhân viên, hỗ trợ lọc theo trạng thái/tour/khoảng ngày
router.get('/', requireAuth(['employee']), (req, res) => {
  const { status, tourId, from, to } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const args = [];
  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (tourId) { sql += ' AND tour_id = ?'; args.push(tourId); }
  if (from) { sql += ' AND booking_date >= ?'; args.push(from); }
  if (to) { sql += ' AND booking_date <= ?'; args.push(to); }
  sql += ' ORDER BY booking_date DESC';
  const rows = db.prepare(sql).all(...args);
  res.json(rows.map(withDetails));
});

// Nhân viên xác nhận đơn: wait -> confirmed
router.post('/:id/confirm', requireAuth(['employee']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (b.status !== 'wait') return res.status(400).json({ error: 'Chỉ có thể xác nhận đơn đang ở trạng thái chờ xác nhận.' });
  db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(b.id);
  res.json(withDetails(db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id)));
});

// Hủy đơn — CHỈ áp dụng cho đơn CHƯA thanh toán (ràng buộc: tour đã thanh toán không được hủy)
router.post('/:id/cancel', requireAuth(['customer', 'employee']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.user.role === 'customer' && b.customer_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  if (b.status === 'paid') return res.status(400).json({ error: 'Đơn đã thanh toán không thể hủy. Vui lòng dùng chức năng đổi tour nếu cần thay đổi.' });
  if (b.status === 'cancelled') return res.status(400).json({ error: 'Đơn này đã được hủy trước đó.' });

  db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
  db.prepare('UPDATE tours SET seats = seats + ? WHERE id=?').run(b.qty, b.tour_id); // hoàn lại chỗ
  res.json(withDetails(db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id)));
});

module.exports = router;
