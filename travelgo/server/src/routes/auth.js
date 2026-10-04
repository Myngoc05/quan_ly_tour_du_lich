const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const router = express.Router();
require('dotenv').config();

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Đăng ký khách hàng — trường theo đúng mô tả: Họ tên, CCCD, Email, SĐT, Mật khẩu
router.post('/register', (req, res) => {
  const { name, cccd, email, phone, password } = req.body;
  if (!name || !cccd || !email || !phone || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  }
  const exists = db.prepare('SELECT id FROM customers WHERE cccd=? OR email=? OR phone=?').get(cccd, email, phone);
  if (exists) return res.status(409).json({ error: 'CCCD, Email hoặc Số điện thoại đã được sử dụng.' });

  const id = 'KH' + Date.now().toString().slice(-8);
  db.prepare(`INSERT INTO customers (id,name,cccd,email,phone,password_hash) VALUES (?,?,?,?,?,?)`)
    .run(id, name, cccd, email, phone, bcrypt.hashSync(password, 10));

  const token = sign({ role: 'customer', id });
  res.json({ token, user: { id, name, email, phone, role: 'customer' } });
});

// Đăng nhập — dùng chung cho khách hàng và nhân viên/admin, đăng nhập bằng email hoặc SĐT
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập.' });

  const cust = db.prepare('SELECT * FROM customers WHERE email=? OR phone=?').get(identifier, identifier);
  if (cust && bcrypt.compareSync(password, cust.password_hash)) {
    if (cust.is_locked) return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hotline 1900 1900.' });
    const token = sign({ role: 'customer', id: cust.id });
    return res.json({ token, user: { id: cust.id, name: cust.name, email: cust.email, phone: cust.phone, role: 'customer' } });
  }

  const emp = db.prepare('SELECT * FROM employees WHERE email=?').get(identifier);
  if (emp && emp.password_hash && bcrypt.compareSync(password, emp.password_hash)) {
    if (!emp.is_active) return res.status(403).json({ error: 'Tài khoản nhân viên đã ngừng hoạt động.' });
    const token = sign({ role: 'employee', id: emp.id, isAdmin: !!emp.is_admin });
    return res.json({ token, user: { id: emp.id, name: emp.name, email: emp.email, role: 'employee', isAdmin: !!emp.is_admin } });
  }

  res.status(401).json({ error: 'Email/SĐT hoặc mật khẩu không đúng.' });
});

module.exports = router;
