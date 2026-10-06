const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

/* ---------- Khách hàng ---------- */
router.get('/khach-hang', requireAuth(['employee']), requirePermission('CUSTOMER_MANAGE'), (req, res) => {
  const rows = db.prepare(`
    SELECT kh.*, (SELECT COUNT(*) FROM phieu_dang_ky p WHERE p.ma_khach_hang = kh.ma_khach_hang AND p.trang_thai != 'da_huy') as so_lan_dat
    FROM khach_hang kh ORDER BY kh.ngay_tao DESC`).all();
  res.json(rows.map(r => ({ ...r, phan_loai: r.so_lan_dat >= 3 ? 'VIP' : 'Khách lẻ' })));
});

router.patch('/khach-hang/:id/khoa', requireAuth(['employee']), requirePermission('CUSTOMER_MANAGE'), (req, res) => {
  const c = db.prepare('SELECT * FROM khach_hang WHERE ma_khach_hang=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
  db.prepare('UPDATE khach_hang SET bi_khoa=? WHERE ma_khach_hang=?').run(c.bi_khoa ? 0 : 1, c.ma_khach_hang);
  res.json({ id: c.ma_khach_hang, bi_khoa: c.bi_khoa ? 0 : 1 });
});

router.get('/khach-hang/me', requireAuth(['customer']), (req, res) => {
  res.json(db.prepare('SELECT ma_khach_hang,ho_ten,so_cccd,sdt,email,dia_chi FROM khach_hang WHERE ma_khach_hang=?').get(req.user.id));
});
router.put('/khach-hang/me', requireAuth(['customer']), (req, res) => {
  const { ho_ten, sdt, email, dia_chi } = req.body;
  try {
    db.prepare('UPDATE khach_hang SET ho_ten=?, sdt=?, email=?, dia_chi=? WHERE ma_khach_hang=?').run(ho_ten, sdt, email, dia_chi || '', req.user.id);
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json(db.prepare('SELECT ma_khach_hang,ho_ten,so_cccd,sdt,email,dia_chi FROM khach_hang WHERE ma_khach_hang=?').get(req.user.id));
});

/* ---------- Nhân viên & vai trò ---------- */
router.get('/vai-tro', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT * FROM vai_tro').all());
});

router.get('/nhan-vien', requireAuth(['employee']), (req, res) => {
  res.json(db.prepare('SELECT ma_nhan_vien,ho_ten,sdt,gioi_tinh,ngay_sinh,dia_chi,chuc_vu,email,ma_vai_tro,trang_thai FROM nhan_vien').all());
});

router.post('/nhan-vien', requireAuth(['employee']), requirePermission('EMPLOYEE_MANAGE'), (req, res) => {
  const { ho_ten, sdt, gioi_tinh, ngay_sinh, dia_chi, chuc_vu, email, password, ma_vai_tro } = req.body;
  if (!ho_ten || !email || !password || !ma_vai_tro) return res.status(400).json({ error: 'Thiếu họ tên, email, mật khẩu hoặc vai trò.' });
  const id = 'NV' + String(Date.now()).slice(-3);
  try {
    db.prepare(`INSERT INTO nhan_vien (ma_nhan_vien,ho_ten,sdt,gioi_tinh,ngay_sinh,dia_chi,chuc_vu,email,mat_khau_hash,ma_vai_tro,trang_thai)
      VALUES (?,?,?,?,?,?,?,?,?,?,'hoat_dong')`)
      .run(id, ho_ten, sdt || null, gioi_tinh || null, ngay_sinh || null, dia_chi || '', chuc_vu || '', email, bcrypt.hashSync(password, 10), ma_vai_tro);
  } catch (e) { return res.status(400).json({ error: e.message.includes('UNIQUE') ? 'Email hoặc SĐT đã được sử dụng.' : e.message }); }
  res.status(201).json({ id, ho_ten, email, ma_vai_tro });
});

router.patch('/nhan-vien/:id/trang-thai', requireAuth(['employee']), requirePermission('EMPLOYEE_MANAGE'), (req, res) => {
  const e = db.prepare('SELECT * FROM nhan_vien WHERE ma_nhan_vien=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
  if (e.ma_vai_tro === 'ADMIN') return res.status(400).json({ error: 'Không thể thay đổi trạng thái của quản trị viên.' });
  const trangThai = req.body.trang_thai;
  if (!['hoat_dong', 'khoa', 'nghi_viec'].includes(trangThai)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  db.prepare('UPDATE nhan_vien SET trang_thai=? WHERE ma_nhan_vien=?').run(trangThai, e.ma_nhan_vien);
  res.json({ id: e.ma_nhan_vien, trang_thai: trangThai });
});

module.exports = router;
