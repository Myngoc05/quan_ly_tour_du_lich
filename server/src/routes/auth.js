const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();
require('dotenv').config();

function sign(payload) { return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }); }
function newId(prefix) { return prefix + Date.now().toString().slice(-8); }

// Đăng ký khách hàng — đúng các trường: Họ tên, CCCD, Email, SĐT, Mật khẩu
router.post('/register', (req, res) => {
  const { name, cccd, email, phone, password } = req.body;
  if (!name || !cccd || !email || !phone || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  }
  if (!/^[0-9]{12}$/.test(cccd)) return res.status(400).json({ error: 'Số CCCD phải gồm đúng 12 chữ số.' });
  if (!/^[0-9]{9,11}$/.test(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });

  const exists = db.prepare('SELECT ma_khach_hang FROM khach_hang WHERE so_cccd=? OR email=? OR sdt=?').get(cccd, email, phone);
  if (exists) return res.status(409).json({ error: 'CCCD, Email hoặc Số điện thoại đã được sử dụng.' });

  const id = newId('KH');
  try {
    db.prepare(`INSERT INTO khach_hang (ma_khach_hang,ho_ten,so_cccd,sdt,email,mat_khau_hash) VALUES (?,?,?,?,?,?)`)
      .run(id, name, cccd, phone, email, bcrypt.hashSync(password, 10));
  } catch (e) { return res.status(400).json({ error: e.message }); }

  const token = sign({ role: 'customer', id });
  res.json({ token, user: { id, name, email, phone, role: 'customer' } });
});

// Đăng nhập — dùng chung cho khách hàng (email/SĐT) và nhân viên (email)
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập.' });

  const cust = db.prepare('SELECT * FROM khach_hang WHERE email=? OR sdt=?').get(identifier, identifier);
  if (cust && bcrypt.compareSync(password, cust.mat_khau_hash)) {
    if (cust.bi_khoa) return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hotline 1900 1900.' });
    const token = sign({ role: 'customer', id: cust.ma_khach_hang });
    return res.json({ token, user: { id: cust.ma_khach_hang, name: cust.ho_ten, email: cust.email, phone: cust.sdt, role: 'customer' } });
  }

  const emp = db.prepare('SELECT * FROM nhan_vien WHERE email=?').get(identifier);
  if (emp && bcrypt.compareSync(password, emp.mat_khau_hash)) {
    if (emp.trang_thai !== 'hoat_dong') return res.status(403).json({ error: 'Tài khoản nhân viên đã bị khóa hoặc nghỉ việc.' });
    const perms = db.prepare('SELECT ma_quyen FROM vai_tro_quyen WHERE ma_vai_tro=?').all(emp.ma_vai_tro).map(r => r.ma_quyen);
    const token = sign({ role: 'employee', id: emp.ma_nhan_vien, vaiTro: emp.ma_vai_tro, isAdmin: emp.ma_vai_tro === 'ADMIN' });
    return res.json({ token, user: { id: emp.ma_nhan_vien, name: emp.ho_ten, email: emp.email, role: 'employee', vaiTro: emp.ma_vai_tro, isAdmin: emp.ma_vai_tro === 'ADMIN', quyen: perms } });
  }

  res.status(401).json({ error: 'Email/SĐT hoặc mật khẩu không đúng.' });
});

module.exports = router;
