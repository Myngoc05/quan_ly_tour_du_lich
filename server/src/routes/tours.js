const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const router = express.Router();

function ratingOf(ma_tour) {
  const r = db.prepare('SELECT diem_tb, so_danh_gia FROM v_diem_tour WHERE ma_tour=?').get(ma_tour);
  return r || { diem_tb: 0, so_danh_gia: 0 };
}
function seatsLeft(ma_khoi_hanh) {
  const r = db.prepare('SELECT cho_con FROM v_cho_con WHERE ma_khoi_hanh=?').get(ma_khoi_hanh);
  return r ? r.cho_con : 0;
}
function serializeKhoiHanh(k) {
  const choCon = seatsLeft(k.ma_khoi_hanh);
  let trangThaiCho = 'con_cho';
  if (choCon <= 0) trangThaiCho = 'het_cho';
  else if (choCon <= 5) trangThaiCho = 'sap_het';
  const discount = k.gia_goc && k.gia_goc > k.gia_nguoi_lon ? Math.round((1 - k.gia_nguoi_lon / k.gia_goc) * 100) : 0;
  return { ...k, cho_con: choCon, trang_thai_cho: trangThaiCho, phan_tram_giam: discount };
}
function serializeTour(t) {
  const khoiHanh = db.prepare(`SELECT * FROM khoi_hanh WHERE ma_tour=? ORDER BY ngay_khoi_hanh ASC`).all(t.ma_tour).map(serializeKhoiHanh);
  const sapToi = khoiHanh.find(k => k.trang_thai === 'mo_ban' && k.ngay_khoi_hanh >= new Date().toISOString().slice(0, 10));
  const { diem_tb, so_danh_gia } = ratingOf(t.ma_tour);
  const daDat = db.prepare(`
    SELECT COALESCE(SUM(p.so_nguoi_lon + p.so_tre_em),0) c FROM phieu_dang_ky p
    JOIN khoi_hanh k ON k.ma_khoi_hanh = p.ma_khoi_hanh
    WHERE k.ma_tour=? AND p.trang_thai <> 'da_huy'`).get(t.ma_tour).c;
  return {
    ...t, khoi_hanh: khoiHanh, khoi_hanh_gan_nhat: sapToi || null,
    diem_danh_gia: diem_tb, so_danh_gia, da_dat: daDat,
    hinh_anh: db.prepare('SELECT * FROM tour_hinh_anh WHERE ma_tour=? ORDER BY thu_tu').all(t.ma_tour),
    dich_vu: db.prepare(`SELECT d.*, td.bao_gom FROM tour_dich_vu td JOIN dich_vu d ON d.ma_dich_vu = td.ma_dich_vu WHERE td.ma_tour=?`).all(t.ma_tour),
    lich_trinh: db.prepare('SELECT * FROM tour_lich_trinh WHERE ma_tour=? ORDER BY ngay_thu').all(t.ma_tour),
  };
}

// Danh sách tour — lọc theo khu vực / từ khóa / khoảng giá (theo giá khởi hành gần nhất)
router.get('/', (req, res) => {
  const { khu_vuc, keyword, minPrice, maxPrice } = req.query;
  let sql = `SELECT * FROM tour WHERE trang_thai = 'hoat_dong'`;
  const args = [];
  if (khu_vuc) { sql += ' AND khu_vuc = ?'; args.push(khu_vuc); }
  if (keyword) { sql += ' AND (ten_tour LIKE ? OR diem_den LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`); }
  let rows = db.prepare(sql).all(...args).map(serializeTour);
  if (minPrice) rows = rows.filter(t => t.khoi_hanh_gan_nhat && t.khoi_hanh_gan_nhat.gia_nguoi_lon >= Number(minPrice));
  if (maxPrice) rows = rows.filter(t => t.khoi_hanh_gan_nhat && t.khoi_hanh_gan_nhat.gia_nguoi_lon <= Number(maxPrice));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tour WHERE ma_tour=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy tour.' });
  res.json(serializeTour(t));
});

// Thêm tour mới — chỉ nhân viên có quyền TOUR_MANAGE
router.post('/', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  const b = req.body;
  if (!b.ten_tour || !b.diem_den || !b.so_ngay) return res.status(400).json({ error: 'Thiếu tên tour, điểm đến hoặc số ngày.' });
  const id = 'T' + Date.now().toString().slice(-6);
  try {
    db.prepare(`INSERT INTO tour (ma_tour,ten_tour,khu_vuc,diem_di,diem_den,so_ngay,so_dem,mo_ta,diem_tham_quan,am_thuc,thoi_gian_ly_tuong,phuong_tien_chinh,dieu_khoan,luu_y)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, b.ten_tour, b.khu_vuc || 'trong_nuoc', b.diem_di || '', b.diem_den, b.so_ngay, b.so_dem || 0,
        b.mo_ta || '', b.diem_tham_quan || '', b.am_thuc || '', b.thoi_gian_ly_tuong || '', b.phuong_tien_chinh || '', b.dieu_khoan || '', b.luu_y || '');
    (b.lich_trinh || []).forEach((nd, i) => db.prepare('INSERT INTO tour_lich_trinh (ma_tour,ngay_thu,tieu_de,noi_dung) VALUES (?,?,?,?)').run(id, i + 1, `Ngày ${i + 1}`, nd));
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.status(201).json(serializeTour(db.prepare('SELECT * FROM tour WHERE ma_tour=?').get(id)));
});

router.put('/:id', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  const t = db.prepare('SELECT * FROM tour WHERE ma_tour=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy tour.' });
  const f = { ...t, ...req.body };
  try {
    db.prepare(`UPDATE tour SET ten_tour=?,khu_vuc=?,diem_di=?,diem_den=?,so_ngay=?,so_dem=?,mo_ta=?,diem_tham_quan=?,am_thuc=?,thoi_gian_ly_tuong=?,phuong_tien_chinh=?,dieu_khoan=?,luu_y=?,trang_thai=? WHERE ma_tour=?`)
      .run(f.ten_tour, f.khu_vuc, f.diem_di, f.diem_den, f.so_ngay, f.so_dem, f.mo_ta, f.diem_tham_quan, f.am_thuc, f.thoi_gian_ly_tuong, f.phuong_tien_chinh, f.dieu_khoan, f.luu_y, f.trang_thai, t.ma_tour);
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json(serializeTour(db.prepare('SELECT * FROM tour WHERE ma_tour=?').get(t.ma_tour)));
});

// Xóa / ngừng tour: nếu đã có khởi hành thì CSDL (trigger) sẽ chặn xóa cứng — chuyển sang "ngừng hoạt động"
router.delete('/:id', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  try {
    db.prepare('DELETE FROM tour WHERE ma_tour=?').run(req.params.id);
    res.json({ ok: true, mode: 'deleted' });
  } catch (e) {
    db.prepare(`UPDATE tour SET trang_thai='ngung' WHERE ma_tour=?`).run(req.params.id);
    res.json({ ok: true, mode: 'stopped', note: 'Tour đã có khởi hành nên được chuyển sang trạng thái ngừng hoạt động thay vì xóa.' });
  }
});

// ---- Khởi hành (các chuyến đi cụ thể của một tour) ----
router.post('/:id/khoi-hanh', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  const b = req.body;
  const id = 'KH' + Date.now().toString().slice(-8);
  try {
    db.prepare(`INSERT INTO khoi_hanh (ma_khoi_hanh,ma_tour,ngay_khoi_hanh,gio_khoi_hanh,dia_diem_khoi_hanh,gia_nguoi_lon,gia_tre_em,gia_goc,so_cho_toi_da)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, req.params.id, b.ngay_khoi_hanh, b.gio_khoi_hanh || '06:00', b.dia_diem_khoi_hanh || '', b.gia_nguoi_lon, b.gia_tre_em, b.gia_goc || 0, b.so_cho_toi_da);
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.status(201).json(serializeKhoiHanh(db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(id)));
});

router.put('/khoi-hanh/:id', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  const k = db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(req.params.id);
  if (!k) return res.status(404).json({ error: 'Không tìm thấy khởi hành.' });
  const f = { ...k, ...req.body };
  try {
    db.prepare(`UPDATE khoi_hanh SET ngay_khoi_hanh=?,gio_khoi_hanh=?,dia_diem_khoi_hanh=?,gia_nguoi_lon=?,gia_tre_em=?,gia_goc=?,so_cho_toi_da=?,trang_thai=? WHERE ma_khoi_hanh=?`)
      .run(f.ngay_khoi_hanh, f.gio_khoi_hanh, f.dia_diem_khoi_hanh, f.gia_nguoi_lon, f.gia_tre_em, f.gia_goc, f.so_cho_toi_da, f.trang_thai, k.ma_khoi_hanh);
  } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json(serializeKhoiHanh(db.prepare('SELECT * FROM khoi_hanh WHERE ma_khoi_hanh=?').get(k.ma_khoi_hanh)));
});

router.delete('/khoi-hanh/:id', requireAuth(['employee']), requirePermission('TOUR_MANAGE'), (req, res) => {
  try {
    db.prepare('DELETE FROM khoi_hanh WHERE ma_khoi_hanh=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Khởi hành đã có đơn đăng ký, chỉ có thể đóng bán hoặc hủy (đổi trạng thái).' });
  }
});

module.exports = router;
