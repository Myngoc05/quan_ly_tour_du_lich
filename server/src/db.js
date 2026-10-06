const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/travelgo.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const alreadyInitialized = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='tour'`
).get();

if (!alreadyInitialized) {
  // Chạy ĐÚNG NGUYÊN VĂN file schema.sql: tạo bảng, view, trigger, và dữ liệu
  // vai_tro/quyen/cau_hinh khởi tạo đã có sẵn trong chính file này.
  db.exec(schemaSql);
  seedDemoData();
}

function dropAllTriggers() {
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`).all();
  rows.forEach(r => db.exec(`DROP TRIGGER ${r.name}`));
}
function restoreAllTriggers() {
  // Lấy lại đúng đoạn SQL định nghĩa trigger trong file gốc để khôi phục y nguyên,
  // không tự viết lại logic trigger ở phía ứng dụng.
  const start = schemaSql.indexOf('-- TRIGGER  –  PHIẾU ĐĂNG KÝ');
  const end = schemaSql.indexOf('-- DỮ LIỆU KHỞI TẠO');
  const triggersSql = schemaSql.slice(start, end);
  db.exec(triggersSql);
}

function seedDemoData() {
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  // ---- Nhân viên (mật khẩu đều là 123456, riêng admin là admin123) ----
  const insNV = db.prepare(`INSERT INTO nhan_vien (ma_nhan_vien,ho_ten,sdt,gioi_tinh,ngay_sinh,dia_chi,chuc_vu,email,mat_khau_hash,ma_vai_tro,trang_thai) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  insNV.run('NV001', 'Quản trị viên', '0912345678', 'Nữ', '1998-04-12', 'Q3, TP.HCM', 'Quản trị hệ thống', 'admin@travelgo.vn', bcrypt.hashSync('admin123', 10), 'ADMIN', 'hoat_dong');
  insNV.run('NV002', 'Trần Văn Nam', '0912345671', 'Nam', '1995-02-10', 'Q7, TP.HCM', 'Điều hành tour', 'nam@travelgo.vn', bcrypt.hashSync('123456', 10), 'DIEU_HANH', 'hoat_dong');
  insNV.run('NV003', 'Lê Thị Mai', '0987654321', 'Nữ', '1997-06-20', 'Q2, TP.HCM', 'Chăm sóc khách hàng', 'mai@travelgo.vn', bcrypt.hashSync('123456', 10), 'CSKH', 'hoat_dong');
  insNV.run('NV004', 'Đỗ Minh Khoa', '0988887777', 'Nam', '1993-09-15', 'Q9, TP.HCM', 'Kế toán', 'khoa@travelgo.vn', bcrypt.hashSync('123456', 10), 'KE_TOAN', 'nghi_viec');

  // ---- Khách hàng ----
  db.prepare(`INSERT INTO khach_hang (ma_khach_hang,ho_ten,so_cccd,sdt,email,dia_chi,mat_khau_hash,bi_khoa) VALUES (?,?,?,?,?,?,?,0)`)
    .run('KH001', 'Nguyễn Thị Ngọc', '079123456789', '0901234567', 'ngoc@mail.com', 'Q1, TP.HCM', bcrypt.hashSync('123456', 10));

  // ---- Nhà cung cấp & dịch vụ ----
  const insNCC = db.prepare(`INSERT INTO nha_cung_cap (ma_ncc,ten_ncc,loai,nguoi_lien_he,sdt,email,gia_hop_dong,trang_thai) VALUES (?,?,?,?,?,?,?,'hop_tac')`);
  insNCC.run('NCC001', 'Khách sạn Mường Thanh Đà Nẵng', 'Khách sạn', 'Nguyễn Văn Khách', '0905111222', 'sales@muongthanh.vn', 850000);
  insNCC.run('NCC002', 'Nhà xe Phương Trang', 'Vận chuyển', 'Trần Thị Xe', '0909222333', 'lienhe@futabus.vn', 300000);
  insNCC.run('NCC003', 'Vietjet Air', 'Vé máy bay', 'Lê Văn Bay', '1900 1886', 'corp@vietjetair.com', 1200000);
  insNCC.run('NCC004', 'Nhà hàng Hải Sản Biển Đông', 'Nhà hàng', 'Phạm Thị Hải', '0918333444', 'contact@biendong.vn', 250000);

  const insDV = db.prepare(`INSERT INTO dich_vu (ma_dich_vu,ten_dich_vu,loai,ma_ncc,don_gia) VALUES (?,?,?,?,?)`);
  insDV.run('DV001', 'Xe du lịch 45 chỗ', 'phuong_tien', 'NCC002', 300000);
  insDV.run('DV002', 'Khách sạn 3 sao', 'khach_san', 'NCC001', 500000);
  insDV.run('DV003', 'Khách sạn 4 sao', 'khach_san', 'NCC001', 850000);
  insDV.run('DV004', 'Vé máy bay khứ hồi', 'phuong_tien', 'NCC003', 1200000);
  insDV.run('DV005', 'Buffet hải sản', 'an_uong', 'NCC004', 250000);

  // ---- Tour (mẫu) + lịch trình + dịch vụ kèm theo ----
  const tours = [
    { id: 'T001', ten: 'Đà Nẵng - Hội An - Bà Nà', kv: 'trong_nuoc', di: 'TP.HCM', den: 'Đà Nẵng', ngay: 4, dem: 3,
      lich: ['Đà Nẵng - Ngũ Hành Sơn - Hội An', 'Hội An - Bà Nà Hills', 'Tự do tắm biển Mỹ Khê', 'Tiễn sân bay'] },
    { id: 'T002', ten: 'Phú Quốc Nghỉ Dưỡng', kv: 'trong_nuoc', di: 'TP.HCM', den: 'Phú Quốc', ngay: 3, dem: 2,
      lich: ['Đón sân bay - Nghỉ dưỡng resort', 'Tour 4 đảo Nam Phú Quốc', 'Chợ đêm - Tiễn sân bay'] },
    { id: 'T003', ten: 'Singapore - Malaysia', kv: 'nuoc_ngoai', di: 'TP.HCM', den: 'Singapore', ngay: 5, dem: 4,
      lich: ['Khởi hành - Singapore', 'Gardens by the Bay', 'Sang Malaysia', 'Kuala Lumpur city tour', 'Về nước'] },
    { id: 'T004', ten: 'Bangkok - Pattaya', kv: 'nuoc_ngoai', di: 'TP.HCM', den: 'Bangkok', ngay: 5, dem: 4,
      lich: ['Khởi hành - Bangkok', 'Chùa Vàng - Cung điện', 'Pattaya - đảo Coral', 'Chợ nổi', 'Về nước'] },
    { id: 'T005', ten: 'Sapa - Fansipan', kv: 'trong_nuoc', di: 'Hà Nội', den: 'Sapa', ngay: 3, dem: 2,
      lich: ['Hà Nội - Sapa', 'Chinh phục Fansipan', 'Bản Cát Cát - về Hà Nội'] },
  ];
  const insTour = db.prepare(`INSERT INTO tour (ma_tour,ten_tour,khu_vuc,diem_di,diem_den,so_ngay,so_dem,mo_ta,diem_tham_quan,am_thuc,thoi_gian_ly_tuong,phuong_tien_chinh,dieu_khoan,luu_y,trang_thai) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'hoat_dong')`);
  const insLich = db.prepare(`INSERT INTO tour_lich_trinh (ma_tour,ngay_thu,tieu_de,noi_dung) VALUES (?,?,?,?)`);
  const insTourDV = db.prepare(`INSERT INTO tour_dich_vu (ma_tour,ma_dich_vu,bao_gom) VALUES (?,?,1)`);
  tours.forEach(t => {
    insTour.run(t.id, t.ten, t.kv, t.di, t.den, t.ngay, t.dem,
      `Hành trình ${t.ten} ${t.ngay} ngày ${t.dem} đêm, trải nghiệm trọn vẹn điểm đến ${t.den}.`,
      `Các điểm tham quan nổi bật tại ${t.den}.`, 'Đặc sản địa phương, hải sản tươi ngon.',
      'Quanh năm, đẹp nhất vào mùa khô.', t.kv === 'nuoc_ngoai' ? 'Máy bay' : 'Xe du lịch',
      'Giá đã bao gồm xe/vé, khách sạn, hướng dẫn viên, bảo hiểm du lịch. Chưa gồm chi phí cá nhân.',
      'Hành khách mang theo giấy tờ tùy thân hợp lệ khi tham gia tour.');
    t.lich.forEach((nd, i) => insLich.run(t.id, i + 1, `Ngày ${i + 1}: ${nd.split(' - ')[0]}`, nd));
    insTourDV.run(t.id, t.kv === 'nuoc_ngoai' ? 'DV004' : 'DV001');
    insTourDV.run(t.id, 'DV003');
  });

  // ---- Khởi hành: mỗi tour có 1 chuyến SẮP TỚI (đặt được) + 1 chuyến ĐÃ QUA (để có lịch sử/đánh giá) ----
  const insKH = db.prepare(`INSERT INTO khoi_hanh (ma_khoi_hanh,ma_tour,ngay_khoi_hanh,gio_khoi_hanh,dia_diem_khoi_hanh,gia_nguoi_lon,gia_tre_em,gia_goc,so_cho_toi_da,trang_thai) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const priceMap = { T001: [5990000, 3500000, 7500000], T002: [4990000, 3000000, 0], T003: [12990000, 8000000, 0], T004: [11990000, 7500000, 0], T005: [4590000, 2800000, 0] };
  const futureOffset = { T001: 20, T002: 25, T003: 30, T004: 22, T005: 18 };
  const seatsMap = { T001: 24, T002: 30, T003: 12, T004: 18, T005: 9 };
  tours.forEach(t => {
    const [gl, gt, gg] = priceMap[t.id];
    insKH.run('KH-' + t.id + '-F1', t.id, addDays(futureOffset[t.id]), '06:00', t.di, gl, gt, gg, seatsMap[t.id], 'mo_ban');
  });
  // Khởi hành đã qua (phục vụ dữ liệu lịch sử) — tạo trực tiếp, không bị trigger chặn vì sẽ seed dữ liệu sau khi tắt trigger
  const pastOffsets = { T001: [-40, -10], T002: [-70], T003: [-100], T005: [-130] };
  Object.entries(pastOffsets).forEach(([tourId, offsets]) => {
    const [gl, gt, gg] = priceMap[tourId];
    offsets.forEach((off, i) => insKH.run(`KH-${tourId}-P${i + 1}`, tourId, addDays(off), '06:00', tours.find(x => x.id === tourId).di, gl, gt, gg, seatsMap[tourId], 'da_di'));
  });

  // =========================================================================
  // Từ đây trở xuống cần tạo dữ liệu LỊCH SỬ (đơn đã hoàn thành/đã hủy ở quá khứ).
  // Trigger trong schema CHỦ ĐÍCH không cho tạo đơn cho khởi hành đã qua ngày,
  // nên tạm gỡ trigger để chèn dữ liệu minh họa, sau đó khôi phục NGUYÊN VẸN
  // để mọi thao tác thật của người dùng vẫn được CSDL kiểm soát chặt chẽ.
  // =========================================================================
  dropAllTriggers();

  const insPDK = db.prepare(`INSERT INTO phieu_dang_ky
    (so_phieu_dang_ky,ma_khach_hang,ma_khoi_hanh,ngay_dang_ky,so_nguoi_lon,so_tre_em,ma_phuong_tien,ma_khach_san,
     don_gia_nguoi_lon,don_gia_tre_em,tong_tien,trang_thai,da_doi_tour,ma_nv_xu_ly,ngay_huy,ly_do_huy,phi_huy)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insHK = db.prepare(`INSERT INTO hanh_khach (so_phieu_dang_ky,ho_ten,gioi_tinh,la_tre_em) VALUES (?,?,?,?)`);
  const insHD = db.prepare(`INSERT INTO hoa_don (ma_hoa_don,so_phieu_dang_ky,ma_nhan_vien,ngay_lap,tong_tien,so_tien_da_thanh_toan) VALUES (?,?,?,?,?,?)`);
  const insTT = db.prepare(`INSERT INTO thanh_toan (ma_giao_dich,ma_hoa_don,loai,so_tien,phuong_thuc,trang_thai,ngay_giao_dich,ma_nv_duyet) VALUES (?,?,?,?,?,'thanh_cong',?,?)`);
  const insDG = db.prepare(`INSERT INTO danh_gia (ma_danh_gia,ma_tour,ma_khach_hang,so_phieu_dang_ky,so_sao,noi_dung,ngay_danh_gia) VALUES (?,?,?,?,?,?,?)`);

  let seqPdk = 1, seqHd = 1, seqTt = 1, seqDg = 1;
  const methods = ['Ví điện tử', 'Thẻ ATM', 'Chuyển khoản', 'Tiền mặt'];

  // Vài đơn LỊCH SỬ đã hoàn thành (trải trong các tháng trước) để báo cáo có dữ liệu
  const histPlan = [
    ['T001', 'KH-T001-P1', -40], ['T001', 'KH-T001-P2', -10], ['T002', 'KH-T002-P1', -70],
    ['T003', 'KH-T003-P1', -100], ['T005', 'KH-T005-P1', -130],
  ];
  const reviewComments = [
    'Dịch vụ rất tốt, hướng dẫn viên nhiệt tình, cảnh đẹp!', 'Lịch trình hợp lý, khách sạn sạch sẽ.',
    'Tour ổn, đồ ăn hơi ít lựa chọn.', 'Biển đẹp, resort xịn, sẽ quay lại.', 'Giá hơi cao nhưng xứng đáng.',
  ];
  histPlan.forEach(([tourId, khId, offset], idx) => {
    const soNguoiLon = 2, soTreEm = idx % 2;
    const [gl, gt] = priceMap[tourId];
    const tongTien = soNguoiLon * gl + soTreEm * gt;
    const pdkId = 'PDK' + String(seqPdk++).padStart(4, '0');
    const ngayDangKy = new Date(); ngayDangKy.setDate(ngayDangKy.getDate() + offset - 20);
    insPDK.run(pdkId, 'KH001', khId, ngayDangKy.toISOString().slice(0, 10), soNguoiLon, soTreEm, 'DV001', 'DV003',
      gl, gt, tongTien, 'hoan_thanh', 0, 'NV002', null, null, 0);
    insHK.run(pdkId, 'Nguyễn Thị Ngọc', 'Nữ', 0);
    insHK.run(pdkId, 'Nguyễn Văn Khách', 'Nam', 0);
    if (soTreEm) insHK.run(pdkId, 'Nguyễn Gia Bảo', 'Nam', 1);
    const hdId = 'HD' + String(seqHd++).padStart(5, '0');
    insHD.run(hdId, pdkId, 'NV004', addDays(offset - 18), tongTien, tongTien);
    insTT.run('GD' + String(seqTt++).padStart(5, '0'), hdId, 'thu', tongTien, methods[idx % methods.length], addDays(offset - 18), 'NV004');
    insDG.run('RV' + String(seqDg++).padStart(4, '0'), tourId, 'KH001', pdkId, 4 + (idx % 2), reviewComments[idx % reviewComments.length], addDays(offset + 2));
  });

  // Một đơn LỊCH SỬ đã hủy (minh họa chức năng hủy đơn)
  const cancelPdkId = 'PDK' + String(seqPdk++).padStart(4, '0');
  insPDK.run(cancelPdkId, 'KH001', 'KH-T002-F1', addDays(-3), 2, 0, 'DV001', 'DV002', 4990000, 3000000, 9980000, 'da_huy', 0, null, addDays(-1), 'Khách đổi lịch công tác đột xuất', 0);

  // ---- Đơn ĐANG DIỄN RA (demo tương tác được trong giao diện) ----
  // 1) Chờ xác nhận
  const pdkWait = 'PDK' + String(seqPdk++).padStart(4, '0');
  insPDK.run(pdkWait, 'KH001', 'KH-T001-F1', addDays(0), 2, 1, 'DV001', 'DV003', 5990000, 3500000, 2 * 5990000 + 3500000, 'cho_xac_nhan', 0, null, null, null, 0);
  insHK.run(pdkWait, 'Nguyễn Thị Ngọc', 'Nữ', 0);
  insHK.run(pdkWait, 'Nguyễn Văn Khách', 'Nam', 0);
  insHK.run(pdkWait, 'Nguyễn Gia Bảo', 'Nam', 1);

  // 2) Đã xác nhận, đã có hóa đơn nhưng CHƯA thanh toán
  const pdkConfirmed = 'PDK' + String(seqPdk++).padStart(4, '0');
  const tongConfirmed = 2 * priceMap['T002'][0];
  insPDK.run(pdkConfirmed, 'KH001', 'KH-T002-F1', addDays(-1), 2, 0, 'DV001', 'DV002', priceMap['T002'][0], priceMap['T002'][1], tongConfirmed, 'da_xac_nhan', 0, 'NV002', null, null, 0);
  insHK.run(pdkConfirmed, 'Nguyễn Thị Ngọc', 'Nữ', 0);
  insHK.run(pdkConfirmed, 'Trần Văn Lộc', 'Nam', 0);
  const hdConfirmed = 'HD' + String(seqHd++).padStart(5, '0');
  insHD.run(hdConfirmed, pdkConfirmed, 'NV002', addDays(-1), tongConfirmed, 0);

  restoreAllTriggers();
}

module.exports = db;
