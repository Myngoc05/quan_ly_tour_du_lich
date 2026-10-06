const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

router.get('/tong-quan', requireAuth(['employee']), requirePermission('REPORT_VIEW'), (req, res) => {
  const totalTours = db.prepare(`SELECT COUNT(*) c FROM tour WHERE trang_thai='hoat_dong'`).get().c;
  const totalBookings = db.prepare(`SELECT COUNT(*) c FROM phieu_dang_ky WHERE trang_thai != 'da_huy'`).get().c;
  const totalCustomers = db.prepare('SELECT COUNT(*) c FROM khach_hang').get().c;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRow = db.prepare('SELECT thuc_thu FROM v_doanh_thu_thang WHERE thang=?').get(thisMonth);
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(thuc_thu),0) s FROM v_doanh_thu_thang').get().s;
  const recent = db.prepare(`
    SELECT p.so_phieu_dang_ky, p.trang_thai, p.tong_tien, p.ngay_dang_ky, kh.ho_ten as ten_khach, t.ten_tour
    FROM phieu_dang_ky p
    JOIN khach_hang kh ON kh.ma_khach_hang = p.ma_khach_hang
    JOIN khoi_hanh k ON k.ma_khoi_hanh = p.ma_khoi_hanh
    JOIN tour t ON t.ma_tour = k.ma_tour
    ORDER BY p.ngay_dang_ky DESC LIMIT 8`).all();
  res.json({ totalTours, totalBookings, totalCustomers, totalRevenue, monthRevenue: monthRow ? monthRow.thuc_thu : 0, recent });
});

router.get('/doanh-thu-thang', requireAuth(['employee']), requirePermission('REPORT_VIEW'), (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  const rows = db.prepare('SELECT * FROM v_doanh_thu_thang').all();
  const map = Object.fromEntries(rows.map(r => [r.thang, r]));
  res.json(months.map(m => ({ thang: m, label: 'T' + Number(m.slice(5)), thuc_thu: map[m] ? map[m].thuc_thu : 0, so_giao_dich: map[m] ? map[m].so_giao_dich : 0 })));
});

router.get('/doanh-thu-tour', requireAuth(['employee']), requirePermission('REPORT_VIEW'), (req, res) => {
  res.json(db.prepare('SELECT * FROM v_doanh_thu_tour ORDER BY thuc_thu DESC').all());
});

router.get('/cong-no', requireAuth(['employee']), requirePermission('PAYMENT_MANAGE'), (req, res) => {
  res.json(db.prepare('SELECT * FROM v_cong_no ORDER BY so_phieu_dang_ky DESC').all());
});

router.get('/phuong-thuc-thanh-toan', requireAuth(['employee']), requirePermission('REPORT_VIEW'), (req, res) => {
  const rows = db.prepare(`
    SELECT phuong_thuc, COUNT(*) so_luong, SUM(so_tien) tong_tien FROM thanh_toan
    WHERE loai='thu' AND trang_thai='thanh_cong' GROUP BY phuong_thuc`).all();
  const total = rows.reduce((s, r) => s + r.tong_tien, 0) || 1;
  res.json(rows.map(r => ({ ...r, ty_le: Math.round(r.tong_tien / total * 100) })));
});

module.exports = router;
