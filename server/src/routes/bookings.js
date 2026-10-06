const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

function newId(prefix, len) { return prefix + Date.now().toString().slice(-len); }

function withDetails(p) {
  const khoiHanh = db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(p.ma_khoi_hanh);
  const tour = khoiHanh ? db.prepare('SELECT * FROM tour WHERE ma_tour=?').get(khoiHanh.ma_tour) : null;
  const khach = db.prepare('SELECT ma_khach_hang,ho_ten,sdt,email,so_cccd FROM khach_hang WHERE ma_khach_hang=?').get(p.ma_khach_hang);
  const hanhKhach = db.prepare('SELECT * FROM hanh_khach WHERE so_phieu_dang_ky=?').all(p.so_phieu_dang_ky);
  const hoaDon = db.prepare('SELECT * FROM hoa_don WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky);
  const congNo = db.prepare('SELECT * FROM v_cong_no WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky);
  return { ...p, khoi_hanh: khoiHanh, tour, khach_hang: khach, hanh_khach: hanhKhach, hoa_don: hoaDon || null, cong_no: congNo || null };
}

// Khách hàng tạo phiếu đăng ký — mọi ràng buộc nghiệp vụ (khóa, đủ chỗ, đã mở bán, chưa qua ngày)
// đều do TRIGGER của CSDL kiểm tra; backend chỉ tính sẵn đơn giá/tổng tiền đúng công thức.
router.post('/', requireAuth(['customer']), (req, res) => {
  const { ma_khoi_hanh, so_nguoi_lon, so_tre_em, ma_phuong_tien, ma_khach_san } = req.body;
  const kh = db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(ma_khoi_hanh);
  if (!kh) return res.status(404).json({ error: 'Không tìm thấy khởi hành.' });
  const soNL = Number(so_nguoi_lon) || 0, soTE = Number(so_tre_em) || 0;
  const tongTien = soNL * kh.gia_nguoi_lon + soTE * kh.gia_tre_em;
  const id = newId('PDK', 9);

  try {
    db.prepare(`INSERT INTO phieu_dang_ky
      (so_phieu_dang_ky,ma_khach_hang,ma_khoi_hanh,so_nguoi_lon,so_tre_em,ma_phuong_tien,ma_khach_san,don_gia_nguoi_lon,don_gia_tre_em,tong_tien)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, ma_khoi_hanh, soNL, soTE, ma_phuong_tien || null, ma_khach_san || null, kh.gia_nguoi_lon, kh.gia_tre_em, tongTien);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }

  res.status(201).json(withDetails(db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(id)));
});

function cleanErr(e) { return (e.message || '').replace(/^.*RAISE\(ABORT,'|'\).*$/g, '').replace(/^.*: /, ''); }

router.get('/mine', requireAuth(['customer']), (req, res) => {
  const rows = db.prepare('SELECT * FROM phieu_dang_ky WHERE ma_khach_hang=? ORDER BY ngay_dang_ky DESC').all(req.user.id);
  res.json(rows.map(withDetails));
});

router.get('/:id', requireAuth(['customer', 'employee']), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.user.role === 'customer' && p.ma_khach_hang !== req.user.id) return res.status(403).json({ error: 'Không có quyền xem đơn này.' });
  res.json(withDetails(p));
});

// Danh sách cho nhân viên — lọc theo trạng thái / khởi hành / khoảng ngày
router.get('/', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  const { trang_thai, ma_khoi_hanh, from, to } = req.query;
  let sql = 'SELECT * FROM phieu_dang_ky WHERE 1=1';
  const args = [];
  if (trang_thai) { sql += ' AND trang_thai = ?'; args.push(trang_thai); }
  if (ma_khoi_hanh) { sql += ' AND ma_khoi_hanh = ?'; args.push(ma_khoi_hanh); }
  if (from) { sql += ' AND ngay_dang_ky >= ?'; args.push(from); }
  if (to) { sql += ' AND ngay_dang_ky <= ?'; args.push(to); }
  sql += ' ORDER BY ngay_dang_ky DESC';
  res.json(db.prepare(sql).all(...args).map(withDetails));
});

// ---- Hành khách ----
router.post('/:id/hanh-khach', requireAuth(['customer', 'employee']), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.user.role === 'customer' && p.ma_khach_hang !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  const { ho_ten, ngay_sinh, gioi_tinh, so_giay_to, la_tre_em } = req.body;
  if (!ho_ten) return res.status(400).json({ error: 'Vui lòng nhập họ tên hành khách.' });
  try {
    db.prepare('INSERT INTO hanh_khach (so_phieu_dang_ky,ho_ten,ngay_sinh,gioi_tinh,so_giay_to,la_tre_em) VALUES (?,?,?,?,?,?)')
      .run(p.so_phieu_dang_ky, ho_ten, ngay_sinh || null, gioi_tinh || null, so_giay_to || null, la_tre_em ? 1 : 0);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  res.status(201).json(db.prepare('SELECT * FROM hanh_khach WHERE so_phieu_dang_ky=?').all(p.so_phieu_dang_ky));
});

router.delete('/:id/hanh-khach/:hkId', requireAuth(['customer', 'employee']), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (req.user.role === 'customer' && p.ma_khach_hang !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  try {
    db.prepare('DELETE FROM hanh_khach WHERE ma_hanh_khach=? AND so_phieu_dang_ky=?').run(req.params.hkId, p.so_phieu_dang_ky);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  res.json(db.prepare('SELECT * FROM hanh_khach WHERE so_phieu_dang_ky=?').all(p.so_phieu_dang_ky));
});

// Nhân viên xác nhận đơn — yêu cầu danh sách hành khách đã khớp đủ số người lớn/trẻ em (CSDL tự kiểm)
router.post('/:id/xac-nhan', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  try {
    db.prepare(`UPDATE phieu_dang_ky SET trang_thai='da_xac_nhan', ma_nv_xu_ly=? WHERE so_phieu_dang_ky=?`).run(req.user.id, p.so_phieu_dang_ky);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  // Tự tạo hóa đơn nếu đơn chưa có, để sẵn sàng cho bước thanh toán
  const existedInv = db.prepare('SELECT * FROM hoa_don WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky);
  if (!existedInv) {
    const hdId = newId('HD', 7);
    try { db.prepare('INSERT INTO hoa_don (ma_hoa_don,so_phieu_dang_ky,ma_nhan_vien,tong_tien,so_tien_da_thanh_toan) VALUES (?,?,?,?,0)')
      .run(hdId, p.so_phieu_dang_ky, req.user.id, p.tong_tien); } catch (e) { /* bỏ qua nếu đã tồn tại */ }
  }
  res.json(withDetails(db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky)));
});

// Nhân viên hủy đơn — quyết định phí hủy (0 nếu hủy sớm/chưa thanh toán, theo chính sách công ty)
router.post('/:id/huy', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  const phiHuy = Number(req.body.phi_huy) || 0;
  const lyDo = req.body.ly_do || '';
  try {
    db.prepare(`UPDATE phieu_dang_ky SET trang_thai='da_huy', ngay_huy=datetime('now','localtime'), ly_do_huy=?, phi_huy=?, ma_nv_xu_ly=? WHERE so_phieu_dang_ky=?`)
      .run(lyDo, phiHuy, req.user.id, p.so_phieu_dang_ky);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  res.json(withDetails(db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky)));
});

// Nhân viên đánh dấu hoàn thành — CSDL tự kiểm: đã qua ngày khởi hành & đã thanh toán đủ
router.post('/:id/hoan-thanh', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  try {
    db.prepare(`UPDATE phieu_dang_ky SET trang_thai='hoan_thanh' WHERE so_phieu_dang_ky=?`).run(p.so_phieu_dang_ky);
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }
  res.json(withDetails(db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(p.so_phieu_dang_ky)));
});

module.exports = router;
