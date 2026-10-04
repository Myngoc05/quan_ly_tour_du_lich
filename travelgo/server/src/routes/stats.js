const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', requireAuth(['employee']), (req, res) => {
  const totalTours = db.prepare('SELECT COUNT(*) c FROM tours').get().c;
  const totalBookings = db.prepare('SELECT COUNT(*) c FROM bookings').get().c;
  const totalCustomers = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM invoices').get().s;
  const totalUnpaid = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM bookings WHERE status != 'paid'`).get().s;
  const recentBookings = db.prepare(`
    SELECT b.*, c.name as customer_name, t.name as tour_name FROM bookings b
    JOIN customers c ON c.id = b.customer_id JOIN tours t ON t.id = b.tour_id
    ORDER BY b.booking_date DESC LIMIT 8`).all();
  const topTours = db.prepare(`
    SELECT t.id, t.name, COUNT(b.id) as bookingCount FROM tours t
    LEFT JOIN bookings b ON b.tour_id = t.id GROUP BY t.id ORDER BY bookingCount DESC LIMIT 5`).all();
  const revenueByEmployee = db.prepare(`
    SELECT e.id, e.name, COALESCE(SUM(i.amount),0) as revenue FROM employees e
    LEFT JOIN invoices i ON i.employee_id = e.id GROUP BY e.id`).all();

  res.json({ totalTours, totalBookings, totalCustomers, totalPaid, totalUnpaid, recentBookings, topTours, revenueByEmployee });
});

router.get('/invoices', requireAuth(['employee']), (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, b.customer_id, c.name as customer_name FROM invoices i
    JOIN bookings b ON b.id = i.booking_id JOIN customers c ON c.id = b.customer_id
    ORDER BY i.invoice_date DESC`).all();
  res.json(rows);
});

// Doanh thu 12 tháng gần nhất — dùng cho biểu đồ Báo cáo & Tài chính
router.get('/revenue-by-month', requireAuth(['employee']), (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: 'T' + (d.getMonth() + 1) });
  }
  const rows = db.prepare(`SELECT substr(invoice_date,1,7) ym, SUM(amount) total FROM invoices GROUP BY ym`).all();
  const map = Object.fromEntries(rows.map(r => [r.ym, r.total]));
  res.json(months.map(m => ({ label: m.label, total: map[m.key] || 0 })));
});

// Tỷ lệ đơn đặt & doanh thu theo từng tour
router.get('/tour-distribution', requireAuth(['employee']), (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.name, COUNT(b.id) as orders, COALESCE(SUM(b.total),0) as revenue
    FROM tours t LEFT JOIN bookings b ON b.tour_id = t.id AND b.status != 'cancelled'
    GROUP BY t.id ORDER BY revenue DESC`).all();
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0) || 1;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) || 1;
  res.json(rows.map(r => ({ ...r, orderShare: Math.round((r.orders / totalOrders) * 100), revenueShare: Math.round((r.revenue / totalRevenue) * 100) })));
});

// Tỷ trọng theo phương thức thanh toán
router.get('/payment-methods', requireAuth(['employee']), (req, res) => {
  const rows = db.prepare(`SELECT payment_method, COUNT(*) c, SUM(amount) total FROM invoices GROUP BY payment_method`).all();
  const totalAmount = rows.reduce((s, r) => s + r.total, 0) || 1;
  res.json(rows.map(r => ({ method: r.payment_method, count: r.c, total: r.total, share: Math.round((r.total / totalAmount) * 100) })));
});

// Báo cáo tổng hợp theo khoảng thời gian, có so sánh với kỳ trước — dùng cho trang Báo cáo & thống kê
router.get('/reports', requireAuth(['employee']), (req, res) => {
  const days = parseInt(req.query.days || '30');
  const fmtDate = d => d.toISOString().slice(0, 10);
  const today = new Date();
  const curFrom = new Date(today); curFrom.setDate(curFrom.getDate() - days);
  const prevFrom = new Date(curFrom); prevFrom.setDate(prevFrom.getDate() - days);
  const curFromStr = fmtDate(curFrom), prevFromStr = fmtDate(prevFrom);

  const sumInvoices = (from, to) => db.prepare(
    `SELECT COALESCE(SUM(amount),0) s FROM invoices WHERE invoice_date >= ? AND invoice_date < ?`
  ).get(from, to || '9999-12-31').s;
  const countBookings = (from, to) => db.prepare(
    `SELECT COUNT(*) c FROM bookings WHERE booking_date >= ? AND booking_date < ? AND status != 'cancelled'`
  ).get(from, to || '9999-12-31').c;
  const countCustomers = (from, to) => db.prepare(
    `SELECT COUNT(DISTINCT customer_id) c FROM bookings WHERE booking_date >= ? AND booking_date < ?`
  ).get(from, to || '9999-12-31').c;

  const pct = (cur, prev) => { if (!prev) return cur > 0 ? 100 : 0; return Math.round(((cur - prev) / prev) * 1000) / 10; };

  const curRevenue = sumInvoices(curFromStr);
  const prevRevenue = sumInvoices(prevFromStr, curFromStr);
  const curOrders = countBookings(curFromStr);
  const prevOrders = countBookings(prevFromStr, curFromStr);
  const curCustomers = countCustomers(curFromStr);
  const prevCustomers = countCustomers(prevFromStr, curFromStr);

  const tourRows = db.prepare(`
    SELECT t.id, t.name, COUNT(b.id) as orders, COALESCE(SUM(b.total),0) as revenue
    FROM tours t LEFT JOIN bookings b ON b.tour_id = t.id AND b.status != 'cancelled' AND b.booking_date >= ?
    GROUP BY t.id ORDER BY revenue DESC`).all(curFromStr);
  const totalOrders2 = tourRows.reduce((s, r) => s + r.orders, 0) || 1;
  const totalRevenue2 = tourRows.reduce((s, r) => s + r.revenue, 0) || 1;
  const tourDistribution = tourRows.map(r => ({
    ...r,
    orderShare: Math.round((r.orders / totalOrders2) * 100),
    revenueShare: Math.round((r.revenue / totalRevenue2) * 100),
  }));

  res.json({
    range: { days, from: curFromStr },
    totalRevenue: curRevenue, revenueDelta: pct(curRevenue, prevRevenue),
    totalOrders: curOrders, ordersDelta: pct(curOrders, prevOrders),
    totalCustomers: curCustomers, customersDelta: pct(curCustomers, prevCustomers),
    tourDistribution,
  });
});

module.exports = router;
