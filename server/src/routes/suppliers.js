const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

router.get('/nha-cung-cap', requireAuth(['employee']), requirePermission('SUPPLIER_MANAGE'), (req, res) => {
  res.json(db.prepare('SELECT * FROM nha_cung_cap ORDER BY ten_ncc').all());
});
router.post('/nha-cung-cap', requireAuth(['employee']), requirePermission('SUPPLIER_MANAGE'), (req, res) => {
  const { ten_ncc, loai, nguoi_lien_he, sdt, email, gia_hop_dong } = req.body;
  if (!ten_ncc || !loai) return res.status(400).json({ error: 'Thiếu tên hoặc loại nhà cung cấp.' });
  const id = 'NCC' + Date.now().toString().slice(-6);
  try {
    db.prepare(`INSERT INTO nha_cung_cap (ma_ncc,ten_ncc,loai,nguoi_lien_he,sdt,email,gia_hop_dong) VALUES (?,?,?,?,?,?,?)`)
      .run(id, ten_ncc, loai, nguoi_lien_he || '', sdt || '', email || '', gia_hop_dong || 0);
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.status(201).json(db.prepare('SELECT * FROM nha_cung_cap WHERE ma_ncc=?').get(id));
});
router.put('/nha-cung-cap/:id', requireAuth(['employee']), requirePermission('SUPPLIER_MANAGE'), (req, res) => {
  const s = db.prepare('SELECT * FROM nha_cung_cap WHERE ma_ncc=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp.' });
  const f = { ...s, ...req.body };
  db.prepare('UPDATE nha_cung_cap SET ten_ncc=?,loai=?,nguoi_lien_he=?,sdt=?,email=?,gia_hop_dong=?,trang_thai=? WHERE ma_ncc=?')
    .run(f.ten_ncc, f.loai, f.nguoi_lien_he, f.sdt, f.email, f.gia_hop_dong, f.trang_thai, s.ma_ncc);
  res.json(db.prepare('SELECT * FROM nha_cung_cap WHERE ma_ncc=?').get(s.ma_ncc));
});
router.delete('/nha-cung-cap/:id', requireAuth(['employee']), requirePermission('SUPPLIER_MANAGE'), (req, res) => {
  try { db.prepare('DELETE FROM nha_cung_cap WHERE ma_ncc=?').run(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: 'Nhà cung cấp đang được dùng trong dịch vụ, không thể xóa.' }); }
});

router.get('/dich-vu', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT * FROM dich_vu').all());
});
router.post('/dich-vu', requireAuth(['employee']), requirePermission('SUPPLIER_MANAGE'), (req, res) => {
  const { ten_dich_vu, loai, ma_ncc, don_gia } = req.body;
  if (!ten_dich_vu || !loai) return res.status(400).json({ error: 'Thiếu tên hoặc loại dịch vụ.' });
  const id = 'DV' + Date.now().toString().slice(-6);
  db.prepare('INSERT INTO dich_vu (ma_dich_vu,ten_dich_vu,loai,ma_ncc,don_gia) VALUES (?,?,?,?,?)').run(id, ten_dich_vu, loai, ma_ncc || null, don_gia || 0);
  res.status(201).json(db.prepare('SELECT * FROM dich_vu WHERE ma_dich_vu=?').get(id));
});

module.exports = router;
