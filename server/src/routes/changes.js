const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

function cleanErr(e) { return (e.message || '').replace(/^.*RAISE\(ABORT,'|'\).*$/g, '').replace(/^.*: /, ''); }
function newId(prefix, len) { return prefix + Date.now().toString().slice(-len); }

// Nhân viên lập phiếu đổi tour cho một đơn — chênh lệch tiền do CSDL tự tính và kiểm tra đúng công thức,
// cùng toàn bộ điều kiện (chưa đổi lần nào, trong 5 ngày kể từ khi đặt, khởi hành mới cách ngày đổi >= 7 ngày...).
router.post('/', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  const { so_phieu_dang_ky, ma_khoi_hanh_moi, ly_do } = req.body;
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(so_phieu_dang_ky);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  const khMoi = db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(ma_khoi_hanh_moi);
  if (!khMoi) return res.status(404).json({ error: 'Không tìm thấy khởi hành mới.' });

  const chenhLech = p.so_nguoi_lon * khMoi.gia_nguoi_lon + p.so_tre_em * khMoi.gia_tre_em - p.tong_tien;
  const id = newId('PD', 7);
  try {
    db.prepare(`INSERT INTO phieu_doi_tour (ma_phieu_doi,so_phieu_dang_ky,ma_khach_hang,ma_khoi_hanh_cu,ma_khoi_hanh_moi,ma_nhan_vien,chenh_lech,ly_do)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(id, so_phieu_dang_ky, p.ma_khach_hang, p.ma_khoi_hanh, ma_khoi_hanh_moi, req.user.id, chenhLech, ly_do || '');
  } catch (e) { return res.status(400).json({ error: cleanErr(e) }); }

  res.status(201).json({
    message: chenhLech > 0 ? `Đổi tour thành công. Khách cần thanh toán thêm ${chenhLech.toLocaleString('vi-VN')}đ.`
      : chenhLech < 0 ? `Đổi tour thành công. Cần hoàn lại khách ${Math.abs(chenhLech).toLocaleString('vi-VN')}đ.`
      : 'Đổi tour thành công, không phát sinh chênh lệch.',
    phieu_doi: db.prepare('SELECT * FROM phieu_doi_tour WHERE ma_phieu_doi=?').get(id),
  });
});

router.get('/', requireAuth(['employee']), requirePermission('BOOKING_MANAGE'), (req, res) => {
  res.json(db.prepare('SELECT * FROM phieu_doi_tour ORDER BY ngay_doi DESC').all());
});

module.exports = router;
