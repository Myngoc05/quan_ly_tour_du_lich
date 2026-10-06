const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function cleanErr(e) { return (e.message || '').replace(/^.*RAISE\(ABORT,'|'\).*$/g, '').replace(/^.*: /, ''); }
function newId(prefix, len) { return prefix + Date.now().toString().slice(-len); }

router.get('/tours/:tourId/danh-gia', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, kh.ho_ten FROM danh_gia d JOIN khach_hang kh ON kh.ma_khach_hang = d.ma_khach_hang
    WHERE d.ma_tour=? AND d.hien_thi=1 ORDER BY d.ngay_danh_gia DESC`).all(req.params.tourId);
  const avg = db.prepare('SELECT diem_tb, so_danh_gia FROM v_diem_tour WHERE ma_tour=?').get(req.params.tourId) || { diem_tb: 0, so_danh_gia: 0 };
  res.json({ danh_gia: rows, diem_tb: avg.diem_tb, so_danh_gia: avg.so_danh_gia });
});

// Khách hàng đánh giá một đơn ĐÃ HOÀN THÀNH — CSDL tự kiểm điều kiện này qua trigger
router.post('/danh-gia', requireAuth(['customer']), (req, res) => {
  const { so_phieu_dang_ky, so_sao, noi_dung } = req.body;
  const p = db.prepare('SELECT * FROM phieu_dang_ky WHERE so_phieu_dang_ky=?').get(so_phieu_dang_ky);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy đơn.' });
  if (p.ma_khach_hang !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
  if (!so_sao || so_sao < 1 || so_sao > 5) return res.status(400).json({ error: 'Vui lòng chọn số sao từ 1 đến 5.' });
  const khoiHanh = db.prepare('SELECT ma_tour FROM khoi_hanh WHERE ma_khoi_hanh=?').get(p.ma_khoi_hanh);
  const id = newId('RV', 8);
  try {
    db.prepare('INSERT INTO danh_gia (ma_danh_gia,ma_tour,ma_khach_hang,so_phieu_dang_ky,so_sao,noi_dung) VALUES (?,?,?,?,?,?)')
      .run(id, khoiHanh.ma_tour, req.user.id, so_phieu_dang_ky, so_sao, noi_dung || '');
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) return res.status(409).json({ error: 'Đơn này đã được đánh giá rồi.' });
    return res.status(400).json({ error: cleanErr(e) });
  }
  res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá!' });
});

router.get('/danh-gia/mine', requireAuth(['customer']), (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, t.ten_tour FROM danh_gia d JOIN tour t ON t.ma_tour = d.ma_tour
    WHERE d.ma_khach_hang=? ORDER BY d.ngay_danh_gia DESC`).all(req.user.id);
  res.json(rows);
});

// Nhân viên ẩn/hiện một đánh giá không phù hợp
router.patch('/danh-gia/:id/hien-thi', requireAuth(['employee']), (req, res) => {
  const d = db.prepare('SELECT * FROM danh_gia WHERE ma_danh_gia=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
  db.prepare('UPDATE danh_gia SET hien_thi=? WHERE ma_danh_gia=?').run(d.hien_thi ? 0 : 1, d.ma_danh_gia);
  res.json({ ok: true, hien_thi: d.hien_thi ? 0 : 1 });
});

module.exports = router;
