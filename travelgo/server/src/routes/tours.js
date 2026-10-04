const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function serialize(t) {
  const reviewAgg = db.prepare('SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE tour_id=?').get(t.id);
  const bookedAgg = db.prepare(`SELECT COALESCE(SUM(qty),0) s FROM bookings WHERE tour_id=? AND status != 'cancelled'`).get(t.id);
  const discountPercent = t.old_cost && t.old_cost > t.cost ? Math.round((1 - t.cost / t.old_cost) * 100) : 0;
  let seatStatus = 'active';     // Còn chỗ
  if (t.seats <= 0) seatStatus = 'full';       // Hết chỗ
  else if (t.seats <= 5) seatStatus = 'low';   // Sắp hết
  return {
    ...t,
    schedule: JSON.parse(t.schedule || '[]'),
    rating: Math.round(reviewAgg.a * 10) / 10,
    reviewCount: reviewAgg.c,
    bookedCount: bookedAgg.s,
    discountPercent,
    seatStatus,
  };
}

// Danh sách tour công khai — hỗ trợ lọc theo vùng miền / từ khóa / khoảng giá
router.get('/', (req, res) => {
  const { region, keyword, minPrice, maxPrice } = req.query;
  let sql = "SELECT * FROM tours WHERE status = 'active'";
  const args = [];
  if (region) { sql += ' AND region = ?'; args.push(region); }
  if (keyword) { sql += ' AND (name LIKE ? OR to_place LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`); }
  if (minPrice) { sql += ' AND cost >= ?'; args.push(Number(minPrice)); }
  if (maxPrice) { sql += ' AND cost <= ?'; args.push(Number(maxPrice)); }
  sql += ' ORDER BY depart_date ASC';
  const rows = db.prepare(sql).all(...args).map(serialize);
  const filtered = req.query.seatStatus ? rows.filter(t => t.seatStatus === req.query.seatStatus) : rows;
  res.json(filtered);
});

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tours WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy tour.' });
  res.json(serialize(t));
});

// Thêm tour — chỉ nhân viên/admin
router.post('/', requireAuth(['employee']), (req, res) => {
  const { name, region, from_place, to_place, duration, cost, old_cost, depart_date, seats, schedule } = req.body;
  if (!name || !to_place || !cost || !depart_date || !seats) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (tên, điểm đến, giá, ngày khởi hành, số chỗ).' });
  }
  const id = 'T' + Date.now().toString().slice(-6);
  db.prepare(`INSERT INTO tours (id,name,region,from_place,to_place,duration,cost,old_cost,depart_date,seats,schedule)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, region || 'trongnuoc', from_place || '', to_place, duration || '', cost, old_cost || 0, depart_date, seats, JSON.stringify(schedule || []));
  res.status(201).json(serialize(db.prepare('SELECT * FROM tours WHERE id=?').get(id)));
});

// Sửa tour
router.put('/:id', requireAuth(['employee']), (req, res) => {
  const t = db.prepare('SELECT * FROM tours WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy tour.' });
  const f = { ...t, ...req.body };
  db.prepare(`UPDATE tours SET name=?,region=?,from_place=?,to_place=?,duration=?,cost=?,old_cost=?,depart_date=?,seats=?,status=?,schedule=? WHERE id=?`)
    .run(f.name, f.region, f.from_place, f.to_place, f.duration, f.cost, f.old_cost, f.depart_date, f.seats, f.status, JSON.stringify(f.schedule || JSON.parse(t.schedule || '[]')), t.id);
  res.json(serialize(db.prepare('SELECT * FROM tours WHERE id=?').get(t.id)));
});

// Xóa tour
router.delete('/:id', requireAuth(['employee']), (req, res) => {
  db.prepare('DELETE FROM tours WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
