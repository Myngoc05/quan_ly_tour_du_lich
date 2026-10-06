const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

function cleanErr(e) { return (e.message || '').replace(/^.*RAISE\(ABORT,'|'\).*$/g, '').replace(/^.*: /, ''); }
function newId(prefix, len) { return prefix + Date.now().toString().slice(-len); }

function ensureOwnerOrPermission(req, res, hoaDon) {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(hoaDon.so_phieu_dang_ky);
  if (req.user.role === 'customer' && p.ma_khach_hang !== req.user.id) { res.status(403).json({ error: 'Không có quyền.' }); return false; }
  return true;
}

router.get('/hoa-don', requireAuth(['employee']), requirePermission('PAYMENT_MANAGE'), (req, res) => {
  const rows = db.prepare(`
    SELECT h.*, p.ma_khach_hang, kh.ho_ten as ten_khach, v.trang_thai_thanh_toan, v.con_phai_thu, v.can_hoan
    FROM hoa_don h
    JOIN phieu_dang_ky p ON p.so_phieu_dang_ky = h.so_phieu_dang_ky
    JOIN khach_hang kh ON kh.ma_khach_hang = p.ma_khach_hang
    JOIN v_cong_no v ON v.so_phieu_dang_ky = h.so_phieu_dang_ky
    ORDER BY h.ngay_lap DESC`).all();
  res.json(rows);
});

router.get('/hoa-don/:id', requireAuth(['customer', 'employee']), (req, res) => {
  const h = db.prepare('SELECT * FROM hoa_don WHERE ma_hoa_don=?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  if (!ensureOwnerOrPermission(req, res, h)) return;
  const giaoDich = db.prepare('SELECT * FROM thanh_toan WHERE ma_hoa_don=? ORDER BY ngay_giao_dich DESC').all(h.ma_hoa_don);
  const congNo = db.prepare('SELECT * FROM v_cong_no WHERE so_phieu_dang_ky=?').get(h.so_phieu_dang_ky);
  res.json({ ...h, giao_dich: giaoDich, cong_no: congNo });
});

// Khách hàng (hoặc nhân viên ghi hộ) thực hiện THU tiền cho một hóa đơn
router.post('/hoa-don/:id/thu', requireAuth(['customer', 'employee']), (req, res) => {
  const h = db.prepare('SELECT * FROM hoa_don WHERE ma_hoa_don=?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  if (!ensureOwnerOrPermission(req, res, h)) return;
  const { so_tien, phuong_thuc } = req.body;
  const method = ['QR', 'Ví điện tử', 'Thẻ ATM', 'Chuyển khoản', 'Tiền mặt'].includes(phuong_thuc) ? phuong_thuc : 'QR';
  const id = newId('GD', 8);
  try {
    db.prepare(`INSERT INTO thanh_toan (ma_giao_dich,ma_hoa_don,loai,so_tien,phuong_thuc,trang_thai) VALUES (?,?,'thu',?,?,'thanh_cong')`)
      .run(id, h.ma_hoa_don, so_tien, method);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  const hd = db.prepare('SELECT * FROM hoa_don WHERE ma_hoa_don=?').get(h.ma_hoa_don);
  res.json({ message: 'Thanh toán thành công.', hoa_don: hd });
});

// Nhân viên ghi nhận HOÀN TIỀN (chỉ khi khách đã trả dư — ví dụ do đổi sang tour rẻ hơn hoặc hủy tour)
router.post('/hoa-don/:id/hoan-tien', requireAuth(['employee']), requirePermission('PAYMENT_MANAGE'), (req, res) => {
  const h = db.prepare('SELECT * FROM hoa_don WHERE ma_hoa_don=?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Không tìm thấy hóa đơn.' });
  const { so_tien, phuong_thuc } = req.body;
  const method = ['QR', 'Ví điện tử', 'Thẻ ATM', 'Chuyển khoản', 'Tiền mặt'].includes(phuong_thuc) ? phuong_thuc : 'Chuyển khoản';
  const id = newId('GD', 8);
  try {
    db.prepare(`INSERT INTO thanh_toan (ma_giao_dich,ma_hoa_don,loai,so_tien,phuong_thuc,trang_thai,ma_nv_duyet) VALUES (?,?,'hoan',?,?,'thanh_cong',?)`)
      .run(id, h.ma_hoa_don, so_tien, method, req.user.id);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  res.json({ message: 'Đã ghi nhận hoàn tiền.', hoa_don: db.prepare('SELECT * FROM hoa_don WHERE ma_hoa_don=?').get(h.ma_hoa_don) });
});

// Toàn bộ sổ giao dịch — nhân viên (mục "Quản lý thanh toán > Giao dịch")
router.get('/thanh-toan', requireAuth(['employee']), requirePermission('PAYMENT_MANAGE'), (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, h.so_phieu_dang_ky, kh.ho_ten as ten_khach FROM thanh_toan t
    JOIN hoa_don h ON h.ma_hoa_don = t.ma_hoa_don
    JOIN phieu_dang_ky p ON p.so_phieu_dang_ky = h.so_phieu_dang_ky
    JOIN khach_hang kh ON kh.ma_khach_hang = p.ma_khach_hang
    ORDER BY t.ngay_giao_dich DESC`).all();
  res.json(rows);
});

module.exports = router;
