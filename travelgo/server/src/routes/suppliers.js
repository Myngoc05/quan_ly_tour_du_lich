const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

router.post('/', requireAuth(['employee']), (req, res) => {
  const { name, type, contact_name, phone, email, contract_price } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Thiếu tên hoặc loại nhà cung cấp.' });
  const id = 'NCC' + Date.now().toString().slice(-6);
  db.prepare(`INSERT INTO suppliers (id,name,type,contact_name,phone,email,contract_price,status) VALUES (?,?,?,?,?,?,?,'active')`)
    .run(id, name, type, contact_name || '', phone || '', email || '', contract_price || 0);
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(id));
});

router.put('/:id', requireAuth(['employee']), (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp.' });
  const f = { ...s, ...req.body };
  db.prepare(`UPDATE suppliers SET name=?,type=?,contact_name=?,phone=?,email=?,contract_price=?,status=? WHERE id=?`)
    .run(f.name, f.type, f.contact_name, f.phone, f.email, f.contract_price, f.status, s.id);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id=?').get(s.id));
});

router.delete('/:id', requireAuth(['employee']), (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
