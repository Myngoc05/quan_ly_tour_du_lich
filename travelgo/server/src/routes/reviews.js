const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Danh sách đánh giá của một tour
router.get('/tours/:tourId/reviews', (req, res) => {
  const rows = db.prepare('SELECT * FROM reviews WHERE tour_id=? ORDER BY created_at DESC').all(req.params.tourId);
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  res.json({ reviews: rows, average: Math.round(avg * 10) / 10, count: rows.length });
});

// Khách hàng viết đánh giá — chỉ cho phép nếu đã có đơn ĐÃ THANH TOÁN cho tour này
router.post('/tours/:tourId/reviews', requireAuth(['customer']), (req, res) => {
  const { rating, comment } = req.body;
  const tourId = req.params.tourId;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Vui lòng chọn số sao từ 1 đến 5.' });

  const hasPaid = db.prepare(`SELECT id FROM bookings WHERE customer_id=? AND tour_id=? AND status='paid'`).get(req.user.id, tourId);
  if (!hasPaid) return res.status(403).json({ error: 'Bạn chỉ có thể đánh giá sau khi đã thanh toán tour này.' });

  const already = db.prepare('SELECT id FROM reviews WHERE tour_id=? AND customer_id=?').get(tourId, req.user.id);
  if (already) return res.status(409).json({ error: 'Bạn đã đánh giá tour này rồi.' });

  const cust = db.prepare('SELECT name FROM customers WHERE id=?').get(req.user.id);
  const id = 'RV' + Date.now().toString().slice(-8);
  db.prepare('INSERT INTO reviews (id,tour_id,customer_id,reviewer_name,rating,comment) VALUES (?,?,?,?,?,?)')
    .run(id, tourId, req.user.id, cust ? cust.name : 'Khách hàng', rating, comment || '');
  res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá!' });
});

// Đánh giá của chính khách hàng đang đăng nhập
router.get('/my-reviews', requireAuth(['customer']), (req, res) => {
  const rows = db.prepare(`SELECT r.*, t.name as tour_name FROM reviews r JOIN tours t ON t.id = r.tour_id WHERE r.customer_id=? ORDER BY r.created_at DESC`).all(req.user.id);
  res.json(rows);
});

module.exports = router;
