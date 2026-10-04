const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

/* ---------- Khách hàng (CRM) — chỉ nhân viên xem được toàn bộ ---------- */
router.get('/customers', requireAuth(['employee']), (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.cccd, c.email, c.phone, c.address, c.is_locked,
      (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status != 'cancelled') as bookingCount
    FROM customers c ORDER BY c.created_at DESC`).all();
  // Phân loại đơn giản: >=3 tour đã đặt -> VIP, còn lại -> Khách lẻ
  res.json(rows.map(r => ({ ...r, tier: r.bookingCount >= 3 ? 'VIP' : 'Khách lẻ' })));
});

// Khóa / mở khóa tài khoản khách hàng
router.patch('/customers/:id/lock', requireAuth(['employee']), (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
  db.prepare('UPDATE customers SET is_locked=? WHERE id=?').run(c.is_locked ? 0 : 1, c.id);
  res.json({ id: c.id, is_locked: c.is_locked ? 0 : 1 });
});

// Khách hàng tự sửa thông tin cá nhân của mình
router.put('/customers/me', requireAuth(['customer']), (req, res) => {
  const { name, email, phone, address } = req.body;
  db.prepare('UPDATE customers SET name=?, email=?, phone=?, address=? WHERE id=?')
    .run(name, email, phone, address || '', req.user.id);
  res.json(db.prepare('SELECT id,name,email,phone,address,cccd FROM customers WHERE id=?').get(req.user.id));
});

router.get('/customers/me', requireAuth(['customer']), (req, res) => {
  res.json(db.prepare('SELECT id,name,email,phone,address,cccd FROM customers WHERE id=?').get(req.user.id));
});

/* ---------- Nhân viên ---------- */
router.get('/employees', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT id,name,phone,gender,dob,address,position,email,is_admin,is_active FROM employees').all());
});

// Bật / tắt trạng thái hoạt động của nhân viên — chỉ quản trị viên
router.patch('/employees/:id/status', requireAuth(['employee']), (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thay đổi trạng thái nhân viên.' });
  const e = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
  if (e.is_admin) return res.status(400).json({ error: 'Không thể thay đổi trạng thái của quản trị viên.' });
  db.prepare('UPDATE employees SET is_active=? WHERE id=?').run(e.is_active ? 0 : 1, e.id);
  res.json({ id: e.id, is_active: e.is_active ? 0 : 1 });
});

router.post('/employees', requireAuth(['employee']), (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền thêm nhân viên.' });
  const { name, phone, gender, dob, address, position, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Thiếu họ tên, email hoặc mật khẩu.' });
  const exists = db.prepare('SELECT id FROM employees WHERE email=?').get(email);
  if (exists) return res.status(409).json({ error: 'Email đã được sử dụng.' });
  const id = 'NV' + Date.now().toString().slice(-6);
  db.prepare(`INSERT INTO employees (id,name,phone,gender,dob,address,position,email,password_hash,is_admin)
    VALUES (?,?,?,?,?,?,?,?,?,0)`).run(id, name, phone || '', gender || '', dob || '', address || '', position || '', email, bcrypt.hashSync(password, 10));
  res.status(201).json({ id, name, phone, gender, dob, address, position, email });
});

router.delete('/employees/:id', requireAuth(['employee']), (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xóa nhân viên.' });
  db.prepare('DELETE FROM employees WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
