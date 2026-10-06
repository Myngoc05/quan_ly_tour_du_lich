-- =====================================================================
-- CSDL TRAVELGO v2  (SQLite / better-sqlite3)  -  đã sửa các lỗi P0/P1 sau góp ý
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------
-- 1. PHÂN QUYỀN (chức năng 12, 15)
-- ---------------------------------------------------------------
CREATE TABLE vai_tro (
  ma_vai_tro   TEXT PRIMARY KEY,                 -- ADMIN, DIEU_HANH, CSKH, KETOAN...
  ten_vai_tro  TEXT NOT NULL UNIQUE,
  mo_ta        TEXT
);
CREATE TABLE quyen (
  ma_quyen     TEXT PRIMARY KEY,                 -- vd: TOUR_EDIT, BOOKING_CONFIRM
  ten_quyen    TEXT NOT NULL
);
CREATE TABLE vai_tro_quyen (
  ma_vai_tro   TEXT NOT NULL REFERENCES vai_tro(ma_vai_tro) ON DELETE CASCADE,
  ma_quyen     TEXT NOT NULL REFERENCES quyen(ma_quyen)     ON DELETE CASCADE,
  PRIMARY KEY (ma_vai_tro, ma_quyen)
);

-- ---------------------------------------------------------------
-- 2. NHÂN VIÊN & KHÁCH HÀNG
-- ---------------------------------------------------------------
CREATE TABLE nhan_vien (
  ma_nhan_vien  TEXT PRIMARY KEY CHECK (length(ma_nhan_vien) <= 5),
  ho_ten        TEXT NOT NULL,
  sdt           TEXT UNIQUE CHECK (sdt GLOB '[0-9]*' AND length(sdt) BETWEEN 9 AND 11),
  gioi_tinh     TEXT CHECK (gioi_tinh IN ('Nam','Nữ','Khác')),
  ngay_sinh     TEXT,                              -- YYYY-MM-DD
  dia_chi       TEXT,
  chuc_vu       TEXT,
  email         TEXT NOT NULL UNIQUE,
  mat_khau_hash TEXT NOT NULL,
  ma_vai_tro    TEXT NOT NULL REFERENCES vai_tro(ma_vai_tro),
  trang_thai    TEXT NOT NULL DEFAULT 'hoat_dong' CHECK (trang_thai IN ('hoat_dong','khoa','nghi_viec'))
);

CREATE TABLE khach_hang (
  ma_khach_hang TEXT PRIMARY KEY,
  ho_ten        TEXT NOT NULL,
  so_cccd       TEXT NOT NULL UNIQUE CHECK (length(so_cccd) = 12 AND so_cccd GLOB '[0-9]*'),
  sdt           TEXT NOT NULL UNIQUE CHECK (sdt GLOB '[0-9]*' AND length(sdt) BETWEEN 9 AND 11),
  email         TEXT NOT NULL UNIQUE,
  dia_chi       TEXT DEFAULT '',
  mat_khau_hash TEXT NOT NULL,
  bi_khoa       INTEGER NOT NULL DEFAULT 0 CHECK (bi_khoa IN (0,1)),
  ngay_tao      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------
-- 3. NHÀ CUNG CẤP & DỊCH VỤ (chức năng 13, 8-Dịch vụ)
-- ---------------------------------------------------------------
CREATE TABLE nha_cung_cap (
  ma_ncc      TEXT PRIMARY KEY,
  ten_ncc     TEXT NOT NULL,
  loai        TEXT NOT NULL CHECK (loai IN ('Khách sạn','Vận chuyển','Vé máy bay','Nhà hàng','Tham quan','Khác')),
  nguoi_lien_he TEXT,
  sdt         TEXT,
  email       TEXT,
  gia_hop_dong INTEGER NOT NULL DEFAULT 0 CHECK (gia_hop_dong >= 0),
  trang_thai  TEXT NOT NULL DEFAULT 'hop_tac' CHECK (trang_thai IN ('hop_tac','tam_ngung','cham_dut'))
);

CREATE TABLE dich_vu (                              -- danh mục dịch vụ: phương tiện, khách sạn, ăn uống...
  ma_dich_vu  TEXT PRIMARY KEY,
  ten_dich_vu TEXT NOT NULL,
  loai        TEXT NOT NULL CHECK (loai IN ('phuong_tien','khach_san','an_uong','tham_quan','khac')),
  ma_ncc      TEXT REFERENCES nha_cung_cap(ma_ncc),
  don_gia     INTEGER NOT NULL DEFAULT 0 CHECK (don_gia >= 0)
);

-- ---------------------------------------------------------------
-- 4. TOUR (mẫu tour) – KHỞI HÀNH (lịch + giá + chỗ)
-- ---------------------------------------------------------------
CREATE TABLE tour (
  ma_tour            TEXT PRIMARY KEY,
  ten_tour           TEXT NOT NULL,
  khu_vuc            TEXT NOT NULL CHECK (khu_vuc IN ('trong_nuoc','nuoc_ngoai')),
  diem_di            TEXT NOT NULL,
  diem_den           TEXT NOT NULL,
  so_ngay            INTEGER NOT NULL CHECK (so_ngay > 0),
  so_dem             INTEGER NOT NULL CHECK (so_dem >= 0 AND so_dem <= so_ngay),
  mo_ta              TEXT,
  diem_tham_quan     TEXT,
  am_thuc            TEXT,
  thoi_gian_ly_tuong TEXT,
  phuong_tien_chinh  TEXT,
  dieu_khoan         TEXT,
  luu_y              TEXT,
  trang_thai         TEXT NOT NULL DEFAULT 'hoat_dong' CHECK (trang_thai IN ('hoat_dong','tam_ngung','ngung')),
  ngay_tao           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tour_hinh_anh (
  ma_hinh_anh INTEGER PRIMARY KEY AUTOINCREMENT,
  ma_tour     TEXT NOT NULL REFERENCES tour(ma_tour) ON DELETE CASCADE,
  duong_dan   TEXT NOT NULL,
  la_anh_bia  INTEGER NOT NULL DEFAULT 0 CHECK (la_anh_bia IN (0,1)),
  thu_tu      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tour_lich_trinh (
  ma_tour     TEXT NOT NULL REFERENCES tour(ma_tour) ON DELETE CASCADE,
  ngay_thu    INTEGER NOT NULL CHECK (ngay_thu > 0),
  tieu_de     TEXT NOT NULL,
  noi_dung    TEXT,
  PRIMARY KEY (ma_tour, ngay_thu)
);

CREATE TABLE tour_dich_vu (
  ma_tour     TEXT NOT NULL REFERENCES tour(ma_tour) ON DELETE CASCADE,
  ma_dich_vu  TEXT NOT NULL REFERENCES dich_vu(ma_dich_vu),
  bao_gom     INTEGER NOT NULL DEFAULT 1 CHECK (bao_gom IN (0,1)),  -- 1: đã gồm, 0: không gồm
  PRIMARY KEY (ma_tour, ma_dich_vu)
);

CREATE TABLE khoi_hanh (
  ma_khoi_hanh       TEXT PRIMARY KEY,
  ma_tour            TEXT NOT NULL REFERENCES tour(ma_tour),
  ngay_khoi_hanh     TEXT NOT NULL,                 -- YYYY-MM-DD
  gio_khoi_hanh      TEXT NOT NULL DEFAULT '06:00',
  dia_diem_khoi_hanh TEXT NOT NULL,
  gia_nguoi_lon      INTEGER NOT NULL CHECK (gia_nguoi_lon >= 0),
  gia_tre_em         INTEGER NOT NULL CHECK (gia_tre_em >= 0),
  gia_goc            INTEGER NOT NULL DEFAULT 0 CHECK (gia_goc >= 0),   -- giá cũ để hiển thị giảm giá
  so_cho_toi_da      INTEGER NOT NULL CHECK (so_cho_toi_da > 0),
  trang_thai         TEXT NOT NULL DEFAULT 'mo_ban' CHECK (trang_thai IN ('mo_ban','dong','da_di','huy')),
  UNIQUE (ma_tour, ngay_khoi_hanh, gio_khoi_hanh),
  CHECK (gia_tre_em <= gia_nguoi_lon)
);

-- ---------------------------------------------------------------
-- 5. PHIẾU ĐĂNG KÝ  (v2)
--    * Trạng thái ĐƠN tách khỏi trạng thái THANH TOÁN (xem view v_cong_no)
--    * CHECK ép tong_tien = SL x đơn giá ở cả INSERT lẫn UPDATE
--    * Không cho sửa số người / giá / khởi hành sau khi tạo (muốn đổi: hủy rồi đặt lại,
--      hoặc dùng phieu_doi_tour). Đây là "cách 1" an toàn cho đồ án.
-- ---------------------------------------------------------------
CREATE TABLE phieu_dang_ky (
  so_phieu_dang_ky  TEXT PRIMARY KEY CHECK (length(so_phieu_dang_ky) <= 12),
  ma_khach_hang     TEXT NOT NULL REFERENCES khach_hang(ma_khach_hang),
  ma_khoi_hanh      TEXT NOT NULL REFERENCES khoi_hanh(ma_khoi_hanh),
  ngay_dang_ky      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  so_nguoi_lon      INTEGER NOT NULL CHECK (so_nguoi_lon >= 1),
  so_tre_em         INTEGER NOT NULL DEFAULT 0 CHECK (so_tre_em >= 0),
  so_luong_nguoi    INTEGER GENERATED ALWAYS AS (so_nguoi_lon + so_tre_em) VIRTUAL,
  ma_phuong_tien    TEXT REFERENCES dich_vu(ma_dich_vu),
  ma_khach_san      TEXT REFERENCES dich_vu(ma_dich_vu),
  don_gia_nguoi_lon INTEGER NOT NULL CHECK (don_gia_nguoi_lon >= 0),
  don_gia_tre_em    INTEGER NOT NULL CHECK (don_gia_tre_em >= 0),
  tong_tien         INTEGER NOT NULL CHECK (tong_tien >= 0),
  trang_thai        TEXT NOT NULL DEFAULT 'cho_xac_nhan'
                    CHECK (trang_thai IN ('cho_xac_nhan','da_xac_nhan','hoan_thanh','da_huy')),
  han_giu_cho       TEXT,                           -- NULL = giữ chỗ không hết hạn; hết hạn thì chỗ được nhả
  da_doi_tour       INTEGER NOT NULL DEFAULT 0 CHECK (da_doi_tour IN (0,1)),
  ma_nv_xu_ly       TEXT REFERENCES nhan_vien(ma_nhan_vien),
  ngay_huy          TEXT,
  ly_do_huy         TEXT,
  phi_huy           INTEGER NOT NULL DEFAULT 0,     -- phần khách mất khi hủy; còn lại được hoàn
  CHECK (tong_tien = so_nguoi_lon * don_gia_nguoi_lon + so_tre_em * don_gia_tre_em),
  CHECK (phi_huy BETWEEN 0 AND tong_tien),
  CHECK (trang_thai = 'da_huy' OR phi_huy = 0),
  CHECK (trang_thai <> 'da_huy' OR ngay_huy IS NOT NULL)
);

CREATE TABLE hanh_khach (
  ma_hanh_khach     INTEGER PRIMARY KEY AUTOINCREMENT,
  so_phieu_dang_ky  TEXT NOT NULL REFERENCES phieu_dang_ky(so_phieu_dang_ky) ON DELETE CASCADE,
  ho_ten            TEXT NOT NULL,
  ngay_sinh         TEXT,
  gioi_tinh         TEXT CHECK (gioi_tinh IN ('Nam','Nữ','Khác')),
  so_giay_to        TEXT,
  la_tre_em         INTEGER NOT NULL DEFAULT 0 CHECK (la_tre_em IN (0,1))
);

-- ---------------------------------------------------------------
-- 6. HÓA ĐƠN – THANH TOÁN  (v2)
--    hoa_don.tong_tien  = số tiền khách PHẢI trả theo đơn hiện tại
--                         (= tong_tien đơn; nếu đơn bị hủy = phi_huy)
--    hoa_don.so_tien_da_thanh_toan = tổng thu thành công - tổng hoàn thành công (DB tự tính)
--    Phải thu thêm = tong_tien - da_thanh_toan (nếu > 0); Cần hoàn = ngược lại (xem v_cong_no)
-- ---------------------------------------------------------------
CREATE TABLE hoa_don (
  ma_hoa_don            TEXT PRIMARY KEY CHECK (length(ma_hoa_don) <= 10),
  so_phieu_dang_ky      TEXT NOT NULL UNIQUE REFERENCES phieu_dang_ky(so_phieu_dang_ky),
  ma_nhan_vien          TEXT REFERENCES nhan_vien(ma_nhan_vien),
  ngay_lap              TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tong_tien             INTEGER NOT NULL CHECK (tong_tien >= 0),
  so_tien_da_thanh_toan INTEGER NOT NULL DEFAULT 0 CHECK (so_tien_da_thanh_toan >= 0)
);

CREATE TABLE thanh_toan (
  ma_giao_dich   TEXT PRIMARY KEY,
  ma_hoa_don     TEXT NOT NULL REFERENCES hoa_don(ma_hoa_don),
  loai           TEXT NOT NULL DEFAULT 'thu' CHECK (loai IN ('thu','hoan')),
  so_tien        INTEGER NOT NULL CHECK (so_tien > 0),
  phuong_thuc    TEXT NOT NULL CHECK (phuong_thuc IN ('QR','Ví điện tử','Thẻ ATM','Chuyển khoản','Tiền mặt')),
  trang_thai     TEXT NOT NULL DEFAULT 'cho_xu_ly' CHECK (trang_thai IN ('cho_xu_ly','thanh_cong','that_bai')),
  ngay_giao_dich TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  ma_tham_chieu  TEXT,
  ma_nv_duyet    TEXT REFERENCES nhan_vien(ma_nhan_vien),   -- bắt buộc với giao dịch hoàn
  CHECK (loai = 'thu' OR ma_nv_duyet IS NOT NULL)
);

-- ---------------------------------------------------------------
-- 7. ĐỔI TOUR (v2) – do nhân viên lập; chenh_lech do DB kiểm: phải đúng = tổng mới - tổng cũ
--    Email xác nhận KHÔNG nằm trong DB: backend gửi sau khi transaction commit thành công
-- ---------------------------------------------------------------
CREATE TABLE phieu_doi_tour (
  ma_phieu_doi        TEXT PRIMARY KEY CHECK (length(ma_phieu_doi) <= 12),
  so_phieu_dang_ky    TEXT NOT NULL UNIQUE REFERENCES phieu_dang_ky(so_phieu_dang_ky),
  ma_khach_hang       TEXT NOT NULL REFERENCES khach_hang(ma_khach_hang),
  ma_khoi_hanh_cu     TEXT NOT NULL REFERENCES khoi_hanh(ma_khoi_hanh),
  ma_khoi_hanh_moi    TEXT NOT NULL REFERENCES khoi_hanh(ma_khoi_hanh),
  ma_nhan_vien        TEXT NOT NULL REFERENCES nhan_vien(ma_nhan_vien),   -- đổi tour do NHÂN VIÊN lập phiếu
  ngay_doi            TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  chenh_lech          INTEGER NOT NULL,
  ly_do               TEXT,
  CHECK (ma_khoi_hanh_cu <> ma_khoi_hanh_moi)
);

-- ---------------------------------------------------------------
-- 8. ĐÁNH GIÁ, HỆ THỐNG
-- ---------------------------------------------------------------
CREATE TABLE danh_gia (
  ma_danh_gia       TEXT PRIMARY KEY,
  ma_tour           TEXT NOT NULL REFERENCES tour(ma_tour),
  ma_khach_hang     TEXT NOT NULL REFERENCES khach_hang(ma_khach_hang),
  so_phieu_dang_ky  TEXT NOT NULL UNIQUE REFERENCES phieu_dang_ky(so_phieu_dang_ky),
  so_sao            INTEGER NOT NULL CHECK (so_sao BETWEEN 1 AND 5),
  noi_dung          TEXT,
  ngay_danh_gia     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  hien_thi          INTEGER NOT NULL DEFAULT 1 CHECK (hien_thi IN (0,1))
);
CREATE TABLE cau_hinh (
  khoa     TEXT PRIMARY KEY,
  gia_tri  TEXT NOT NULL,
  mo_ta    TEXT
);
CREATE TABLE nhat_ky (
  ma_nhat_ky   INTEGER PRIMARY KEY AUTOINCREMENT,
  thoi_gian    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  ma_nhan_vien TEXT REFERENCES nhan_vien(ma_nhan_vien),
  hanh_dong    TEXT NOT NULL,
  doi_tuong    TEXT,
  chi_tiet     TEXT
);

-- ---------------------------------------------------------------
-- INDEX
-- ---------------------------------------------------------------
CREATE INDEX ix_khoi_hanh_tour   ON khoi_hanh(ma_tour, ngay_khoi_hanh);
CREATE INDEX ix_tour_tim_kiem    ON tour(khu_vuc, trang_thai, ten_tour);
CREATE INDEX ix_pdk_khach        ON phieu_dang_ky(ma_khach_hang, ngay_dang_ky);
CREATE INDEX ix_pdk_khoi_hanh    ON phieu_dang_ky(ma_khoi_hanh, trang_thai);
CREATE INDEX ix_tt_hoa_don       ON thanh_toan(ma_hoa_don, trang_thai);
CREATE INDEX ix_dg_tour          ON danh_gia(ma_tour, hien_thi);
CREATE INDEX ix_hk_phieu         ON hanh_khach(so_phieu_dang_ky, la_tre_em);

-- ---------------------------------------------------------------
-- VIEW
-- ---------------------------------------------------------------
-- Chỗ còn lại: không tính đơn hủy và đơn giữ chỗ đã hết hạn
CREATE VIEW v_cho_con AS
SELECT k.ma_khoi_hanh, k.ma_tour, k.so_cho_toi_da,
       k.so_cho_toi_da - COALESCE(SUM(p.so_nguoi_lon + p.so_tre_em), 0) AS cho_con
FROM khoi_hanh k
LEFT JOIN phieu_dang_ky p
       ON p.ma_khoi_hanh = k.ma_khoi_hanh
      AND p.trang_thai <> 'da_huy'
      AND NOT (p.trang_thai = 'cho_xac_nhan' AND p.han_giu_cho IS NOT NULL
               AND p.han_giu_cho < datetime('now','localtime'))
GROUP BY k.ma_khoi_hanh;

CREATE VIEW v_diem_tour AS
SELECT ma_tour, ROUND(AVG(so_sao),1) AS diem_tb, COUNT(*) AS so_danh_gia
FROM danh_gia WHERE hien_thi = 1 GROUP BY ma_tour;

-- Công nợ & TRẠNG THÁI THANH TOÁN (độc lập với trạng thái đơn)
CREATE VIEW v_cong_no AS
SELECT p.so_phieu_dang_ky, p.trang_thai AS trang_thai_don,
       h.ma_hoa_don,
       COALESCE(h.tong_tien, p.tong_tien)         AS phai_tra,
       COALESCE(h.so_tien_da_thanh_toan, 0)       AS da_thanh_toan,
       MAX(COALESCE(h.tong_tien, p.tong_tien) - COALESCE(h.so_tien_da_thanh_toan,0), 0) AS con_phai_thu,
       MAX(COALESCE(h.so_tien_da_thanh_toan,0) - COALESCE(h.tong_tien, p.tong_tien), 0) AS can_hoan,
       CASE
         WHEN COALESCE(h.so_tien_da_thanh_toan,0) > COALESCE(h.tong_tien, p.tong_tien) THEN 'can_hoan_tien'
         WHEN COALESCE(h.tong_tien, p.tong_tien) = 0                                    THEN 'khong_phat_sinh'
         WHEN COALESCE(h.so_tien_da_thanh_toan,0) = 0                                   THEN 'chua_thanh_toan'
         WHEN h.so_tien_da_thanh_toan < h.tong_tien                                     THEN 'thanh_toan_mot_phan'
         ELSE 'da_thanh_toan'
       END AS trang_thai_thanh_toan
FROM phieu_dang_ky p LEFT JOIN hoa_don h ON h.so_phieu_dang_ky = p.so_phieu_dang_ky;

-- Báo cáo theo tháng: TÁCH số giao dịch / tiền thu / tiền hoàn / thực thu
CREATE VIEW v_doanh_thu_thang AS
SELECT substr(t.ngay_giao_dich,1,7) AS thang,
       COUNT(*)                                                           AS so_giao_dich,
       COUNT(DISTINCT h.so_phieu_dang_ky)                                 AS so_don_phat_sinh,
       SUM(CASE WHEN t.loai='thu'  THEN t.so_tien ELSE 0 END)             AS tong_thu,
       SUM(CASE WHEN t.loai='hoan' THEN t.so_tien ELSE 0 END)             AS tong_hoan,
       SUM(CASE WHEN t.loai='thu' THEN t.so_tien ELSE -t.so_tien END)     AS thuc_thu
FROM thanh_toan t JOIN hoa_don h ON h.ma_hoa_don = t.ma_hoa_don
WHERE t.trang_thai = 'thanh_cong'
GROUP BY thang;

-- Theo tour: thực thu = tiền đã thu ròng (đã trừ hoàn; đơn hủy chỉ còn phí hủy)
CREATE VIEW v_doanh_thu_tour AS
SELECT tr.ma_tour, tr.ten_tour,
       COUNT(DISTINCT CASE WHEN p.trang_thai <> 'da_huy' THEN p.so_phieu_dang_ky END) AS so_don_hieu_luc,
       COALESCE(SUM(CASE WHEN p.trang_thai <> 'da_huy' THEN p.so_nguoi_lon + p.so_tre_em END),0) AS so_khach,
       COALESCE(SUM(h.so_tien_da_thanh_toan),0) AS thuc_thu
FROM tour tr
JOIN khoi_hanh k ON k.ma_tour = tr.ma_tour
JOIN phieu_dang_ky p ON p.ma_khoi_hanh = k.ma_khoi_hanh
LEFT JOIN hoa_don h ON h.so_phieu_dang_ky = p.so_phieu_dang_ky
GROUP BY tr.ma_tour;

-- ---------------------------------------------------------------
-- TRIGGER  –  PHIẾU ĐĂNG KÝ
-- ---------------------------------------------------------------
-- (1) Tạo đơn
CREATE TRIGGER trg_pdk_bi BEFORE INSERT ON phieu_dang_ky
BEGIN
  SELECT RAISE(ABORT,'Đơn mới phải ở trạng thái cho_xac_nhan, chưa đổi tour, không phí hủy')
    WHERE NEW.trang_thai <> 'cho_xac_nhan' OR NEW.da_doi_tour <> 0 OR NEW.phi_huy <> 0;
  SELECT RAISE(ABORT,'Tài khoản khách hàng đã bị khóa')
    WHERE (SELECT bi_khoa FROM khach_hang WHERE ma_khach_hang = NEW.ma_khach_hang) = 1;
  SELECT RAISE(ABORT,'Khởi hành không còn mở bán')
    WHERE (SELECT trang_thai FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh) <> 'mo_ban';
  SELECT RAISE(ABORT,'Tour đã ngừng hoạt động')
    WHERE (SELECT t.trang_thai FROM tour t JOIN khoi_hanh k ON k.ma_tour = t.ma_tour
           WHERE k.ma_khoi_hanh = NEW.ma_khoi_hanh) <> 'hoat_dong';
  SELECT RAISE(ABORT,'Ngày khởi hành đã qua')
    WHERE (SELECT ngay_khoi_hanh FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh) < date('now','localtime');
  SELECT RAISE(ABORT,'Không đủ chỗ trống')
    WHERE NEW.so_nguoi_lon + NEW.so_tre_em >
          (SELECT cho_con FROM v_cho_con WHERE ma_khoi_hanh = NEW.ma_khoi_hanh);
END;

-- (2) Đúng loại dịch vụ (phương tiện / khách sạn) – cả INSERT lẫn UPDATE
CREATE TRIGGER trg_pdk_loai_dv_i BEFORE INSERT ON phieu_dang_ky
BEGIN
  SELECT RAISE(ABORT,'ma_phuong_tien phải là dịch vụ loại phuong_tien')
    WHERE NEW.ma_phuong_tien IS NOT NULL
      AND (SELECT loai FROM dich_vu WHERE ma_dich_vu = NEW.ma_phuong_tien) <> 'phuong_tien';
  SELECT RAISE(ABORT,'ma_khach_san phải là dịch vụ loại khach_san')
    WHERE NEW.ma_khach_san IS NOT NULL
      AND (SELECT loai FROM dich_vu WHERE ma_dich_vu = NEW.ma_khach_san) <> 'khach_san';
END;
CREATE TRIGGER trg_pdk_loai_dv_u BEFORE UPDATE OF ma_phuong_tien, ma_khach_san ON phieu_dang_ky
BEGIN
  SELECT RAISE(ABORT,'ma_phuong_tien phải là dịch vụ loại phuong_tien')
    WHERE NEW.ma_phuong_tien IS NOT NULL
      AND (SELECT loai FROM dich_vu WHERE ma_dich_vu = NEW.ma_phuong_tien) <> 'phuong_tien';
  SELECT RAISE(ABORT,'ma_khach_san phải là dịch vụ loại khach_san')
    WHERE NEW.ma_khach_san IS NOT NULL
      AND (SELECT loai FROM dich_vu WHERE ma_dich_vu = NEW.ma_khach_san) <> 'khach_san';
END;

-- (3) KHÓA các cột lõi sau khi tạo đơn. Chỉ phieu_doi_tour mới được đổi (qua cờ da_doi_tour 0->1)
CREATE TRIGGER trg_pdk_khoa_cot BEFORE UPDATE OF ma_khach_hang, ma_khoi_hanh, so_nguoi_lon, so_tre_em,
    don_gia_nguoi_lon, don_gia_tre_em, tong_tien, da_doi_tour ON phieu_dang_ky
BEGIN
  SELECT RAISE(ABORT,'Không được sửa khách/khởi hành/số người/giá/tổng tiền. Hãy hủy và đặt lại, hoặc dùng phiếu đổi tour')
    WHERE NOT (
      OLD.da_doi_tour = 0 AND NEW.da_doi_tour = 1
      AND EXISTS (SELECT 1 FROM phieu_doi_tour d
                  WHERE d.so_phieu_dang_ky = OLD.so_phieu_dang_ky
                    AND d.ma_khoi_hanh_moi = NEW.ma_khoi_hanh)
    )
    AND (NEW.ma_khach_hang IS NOT OLD.ma_khach_hang OR NEW.ma_khoi_hanh IS NOT OLD.ma_khoi_hanh
      OR NEW.so_nguoi_lon IS NOT OLD.so_nguoi_lon OR NEW.so_tre_em IS NOT OLD.so_tre_em
      OR NEW.don_gia_nguoi_lon IS NOT OLD.don_gia_nguoi_lon OR NEW.don_gia_tre_em IS NOT OLD.don_gia_tre_em
      OR NEW.tong_tien IS NOT OLD.tong_tien OR NEW.da_doi_tour IS NOT OLD.da_doi_tour);
END;

-- (4) MÁY TRẠNG THÁI ĐƠN:  cho_xac_nhan -> da_xac_nhan -> hoan_thanh ;  (cho_xac_nhan | da_xac_nhan) -> da_huy
CREATE TRIGGER trg_pdk_trang_thai BEFORE UPDATE OF trang_thai ON phieu_dang_ky
WHEN OLD.trang_thai <> NEW.trang_thai
BEGIN
  SELECT RAISE(ABORT,'Chuyển trạng thái không hợp lệ')
    WHERE NOT (
      (OLD.trang_thai = 'cho_xac_nhan' AND NEW.trang_thai IN ('da_xac_nhan','da_huy')) OR
      (OLD.trang_thai = 'da_xac_nhan'  AND NEW.trang_thai IN ('hoan_thanh','da_huy')));

  -- Xác nhận: nhân viên xử lý, còn hạn giữ chỗ, danh sách hành khách khớp số người lớn / trẻ em
  SELECT RAISE(ABORT,'Xác nhận đơn phải do nhân viên thực hiện (ma_nv_xu_ly)')
    WHERE NEW.trang_thai = 'da_xac_nhan' AND NEW.ma_nv_xu_ly IS NULL;
  SELECT RAISE(ABORT,'Đơn đã hết hạn giữ chỗ')
    WHERE NEW.trang_thai = 'da_xac_nhan' AND OLD.han_giu_cho IS NOT NULL
      AND OLD.han_giu_cho < datetime('now','localtime');
  SELECT RAISE(ABORT,'Số hành khách chưa khớp số người lớn / trẻ em của đơn')
    WHERE NEW.trang_thai = 'da_xac_nhan'
      AND ((SELECT COUNT(*) FROM hanh_khach WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky AND la_tre_em = 0) <> OLD.so_nguoi_lon
        OR (SELECT COUNT(*) FROM hanh_khach WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky AND la_tre_em = 1) <> OLD.so_tre_em);

  -- Hoàn thành: đã đến ngày đi và đã thanh toán đủ
  SELECT RAISE(ABORT,'Chưa đến ngày khởi hành')
    WHERE NEW.trang_thai = 'hoan_thanh'
      AND (SELECT ngay_khoi_hanh FROM khoi_hanh WHERE ma_khoi_hanh = OLD.ma_khoi_hanh) > date('now','localtime');
  SELECT RAISE(ABORT,'Đơn chưa thanh toán đủ')
    WHERE NEW.trang_thai = 'hoan_thanh'
      AND NOT EXISTS (SELECT 1 FROM hoa_don WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky
                      AND so_tien_da_thanh_toan >= tong_tien);

  -- Hủy: trong vòng N giờ trước giờ đi mà khách ĐÃ trả tiền thì chỉ nhân viên mới được hủy
  SELECT RAISE(ABORT,'Quá hạn hủy theo chính sách; cần nhân viên xử lý (ma_nv_xu_ly)')
    WHERE NEW.trang_thai = 'da_huy' AND NEW.ma_nv_xu_ly IS NULL
      AND EXISTS (SELECT 1 FROM hoa_don WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky AND so_tien_da_thanh_toan > 0)
      AND ((SELECT julianday(k.ngay_khoi_hanh || ' ' || k.gio_khoi_hanh) FROM khoi_hanh k
            WHERE k.ma_khoi_hanh = OLD.ma_khoi_hanh) - julianday('now','localtime')) * 24
          < (SELECT CAST(gia_tri AS INTEGER) FROM cau_hinh WHERE khoa = 'gio_huy_toi_thieu_truoc_khoi_hanh');
END;

-- (5) Hủy đơn -> hóa đơn chỉ còn phải thu phí hủy; phần đã trả dư sẽ xuất hiện ở "can_hoan"
CREATE TRIGGER trg_pdk_sau_huy AFTER UPDATE OF trang_thai ON phieu_dang_ky
WHEN NEW.trang_thai = 'da_huy' AND OLD.trang_thai <> 'da_huy'
BEGIN
  UPDATE hoa_don SET tong_tien = NEW.phi_huy WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky;
END;

-- ---------------------------------------------------------------
-- TRIGGER  –  HÀNH KHÁCH  (chỉ sửa được khi đơn còn cho_xac_nhan; không vượt số người đã đăng ký)
-- ---------------------------------------------------------------
CREATE TRIGGER trg_hk_bi BEFORE INSERT ON hanh_khach
BEGIN
  SELECT RAISE(ABORT,'Chỉ thêm hành khách khi đơn đang chờ xác nhận')
    WHERE (SELECT trang_thai FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) <> 'cho_xac_nhan';
  SELECT RAISE(ABORT,'Số hành khách người lớn vượt số đã đăng ký')
    WHERE NEW.la_tre_em = 0
      AND (SELECT COUNT(*) FROM hanh_khach WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky AND la_tre_em = 0)
          >= (SELECT so_nguoi_lon FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky);
  SELECT RAISE(ABORT,'Số hành khách trẻ em vượt số đã đăng ký')
    WHERE NEW.la_tre_em = 1
      AND (SELECT COUNT(*) FROM hanh_khach WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky AND la_tre_em = 1)
          >= (SELECT so_tre_em FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky);
  -- Tuổi tại ngày khởi hành phải khớp cờ la_tre_em (tuoi_tre_em_toi_da)
  SELECT RAISE(ABORT,'Ngày sinh không khớp loại hành khách (người lớn / trẻ em)')
    WHERE NEW.ngay_sinh IS NOT NULL
      AND NEW.la_tre_em <> (
        (SELECT (julianday(k.ngay_khoi_hanh) - julianday(NEW.ngay_sinh)) / 365.25
           FROM phieu_dang_ky p JOIN khoi_hanh k ON k.ma_khoi_hanh = p.ma_khoi_hanh
          WHERE p.so_phieu_dang_ky = NEW.so_phieu_dang_ky)
        < (SELECT CAST(gia_tri AS INTEGER) + 1 FROM cau_hinh WHERE khoa = 'tuoi_tre_em_toi_da'));
END;
CREATE TRIGGER trg_hk_bu BEFORE UPDATE ON hanh_khach
BEGIN
  SELECT RAISE(ABORT,'Không sửa phiếu/loại/ngày sinh; hãy xóa và thêm lại')
    WHERE NEW.so_phieu_dang_ky <> OLD.so_phieu_dang_ky OR NEW.la_tre_em <> OLD.la_tre_em
       OR NEW.ngay_sinh IS NOT OLD.ngay_sinh;
  SELECT RAISE(ABORT,'Đơn không còn ở trạng thái chờ xác nhận')
    WHERE (SELECT trang_thai FROM phieu_dang_ky WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky) <> 'cho_xac_nhan';
END;
CREATE TRIGGER trg_hk_bd BEFORE DELETE ON hanh_khach
BEGIN
  SELECT RAISE(ABORT,'Đơn không còn ở trạng thái chờ xác nhận')
    WHERE (SELECT trang_thai FROM phieu_dang_ky WHERE so_phieu_dang_ky = OLD.so_phieu_dang_ky) NOT IN ('cho_xac_nhan');
END;

-- ---------------------------------------------------------------
-- TRIGGER  –  HÓA ĐƠN
-- ---------------------------------------------------------------
CREATE TRIGGER trg_hd_bi BEFORE INSERT ON hoa_don
BEGIN
  SELECT RAISE(ABORT,'Đơn đã hủy, không thể lập hóa đơn')
    WHERE (SELECT trang_thai FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) = 'da_huy';
  SELECT RAISE(ABORT,'Tổng tiền hóa đơn phải bằng tổng tiền đơn và chưa có tiền đã thanh toán')
    WHERE NEW.tong_tien <> (SELECT tong_tien FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky)
       OR NEW.so_tien_da_thanh_toan <> 0;
END;
-- Hóa đơn chỉ được cập nhật khi khớp đơn + sổ giao dịch (không sửa tay)
CREATE TRIGGER trg_hd_bu BEFORE UPDATE ON hoa_don
BEGIN
  SELECT RAISE(ABORT,'Hóa đơn phải khớp đơn đăng ký và sổ giao dịch, không được sửa tay')
    WHERE NEW.so_phieu_dang_ky <> OLD.so_phieu_dang_ky
       OR NEW.tong_tien <> (SELECT CASE trang_thai WHEN 'da_huy' THEN phi_huy ELSE tong_tien END
                              FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky)
       OR NEW.so_tien_da_thanh_toan <> (SELECT COALESCE(SUM(CASE loai WHEN 'thu' THEN so_tien ELSE -so_tien END),0)
                                          FROM thanh_toan WHERE ma_hoa_don = NEW.ma_hoa_don AND trang_thai = 'thanh_cong');
END;
CREATE TRIGGER trg_hd_bd BEFORE DELETE ON hoa_don
BEGIN SELECT RAISE(ABORT,'Không xóa hóa đơn'); END;

-- ---------------------------------------------------------------
-- TRIGGER  –  THANH TOÁN / HOÀN TIỀN
--   Thu : da_thu + so_tien  <= phải_trả
--   Hoàn: so_tien <= da_thu - phải_trả   (chỉ hoàn phần khách trả dư: do đổi sang tour rẻ hơn hoặc hủy tour)
-- ---------------------------------------------------------------
CREATE TRIGGER trg_tt_bi BEFORE INSERT ON thanh_toan
WHEN NEW.trang_thai = 'thanh_cong'
BEGIN
  SELECT RAISE(ABORT,'Số tiền thu vượt phần còn phải thanh toán')
    WHERE NEW.loai = 'thu' AND NEW.so_tien >
      (SELECT tong_tien - so_tien_da_thanh_toan FROM hoa_don WHERE ma_hoa_don = NEW.ma_hoa_don);
  SELECT RAISE(ABORT,'Số tiền hoàn vượt phần khách đã trả dư')
    WHERE NEW.loai = 'hoan' AND NEW.so_tien >
      (SELECT so_tien_da_thanh_toan - tong_tien FROM hoa_don WHERE ma_hoa_don = NEW.ma_hoa_don);
END;
CREATE TRIGGER trg_tt_bu BEFORE UPDATE ON thanh_toan
BEGIN
  SELECT RAISE(ABORT,'Giao dịch đã chốt, không được sửa')
    WHERE OLD.trang_thai <> 'cho_xu_ly';
  SELECT RAISE(ABORT,'Không sửa hóa đơn / loại / số tiền của giao dịch')
    WHERE NEW.ma_hoa_don <> OLD.ma_hoa_don OR NEW.loai <> OLD.loai OR NEW.so_tien <> OLD.so_tien;
  SELECT RAISE(ABORT,'Số tiền thu vượt phần còn phải thanh toán')
    WHERE NEW.trang_thai = 'thanh_cong' AND NEW.loai = 'thu' AND NEW.so_tien >
      (SELECT tong_tien - so_tien_da_thanh_toan FROM hoa_don WHERE ma_hoa_don = NEW.ma_hoa_don);
  SELECT RAISE(ABORT,'Số tiền hoàn vượt phần khách đã trả dư')
    WHERE NEW.trang_thai = 'thanh_cong' AND NEW.loai = 'hoan' AND NEW.so_tien >
      (SELECT so_tien_da_thanh_toan - tong_tien FROM hoa_don WHERE ma_hoa_don = NEW.ma_hoa_don);
END;
CREATE TRIGGER trg_tt_bd BEFORE DELETE ON thanh_toan
BEGIN SELECT RAISE(ABORT,'Không xóa giao dịch (phục vụ đối soát)'); END;

-- Tính lại số đã thanh toán ròng từ sổ giao dịch (idempotent, không bị lệch)
CREATE TRIGGER trg_tt_ai AFTER INSERT ON thanh_toan
WHEN NEW.trang_thai = 'thanh_cong'
BEGIN
  UPDATE hoa_don SET so_tien_da_thanh_toan =
    (SELECT COALESCE(SUM(CASE loai WHEN 'thu' THEN so_tien ELSE -so_tien END),0)
       FROM thanh_toan WHERE ma_hoa_don = NEW.ma_hoa_don AND trang_thai = 'thanh_cong')
   WHERE ma_hoa_don = NEW.ma_hoa_don;
END;
CREATE TRIGGER trg_tt_au AFTER UPDATE OF trang_thai ON thanh_toan
WHEN NEW.trang_thai = 'thanh_cong' AND OLD.trang_thai <> 'thanh_cong'
BEGIN
  UPDATE hoa_don SET so_tien_da_thanh_toan =
    (SELECT COALESCE(SUM(CASE loai WHEN 'thu' THEN so_tien ELSE -so_tien END),0)
       FROM thanh_toan WHERE ma_hoa_don = NEW.ma_hoa_don AND trang_thai = 'thanh_cong')
   WHERE ma_hoa_don = NEW.ma_hoa_don;
END;

-- ---------------------------------------------------------------
-- TRIGGER  –  ĐỔI TOUR  (đồng bộ: đơn + hóa đơn; chênh lệch do DB kiểm)
-- ---------------------------------------------------------------
CREATE TRIGGER trg_doi_bi BEFORE INSERT ON phieu_doi_tour
BEGIN
  SELECT RAISE(ABORT,'Phiếu đăng ký không thuộc khách hàng này')
    WHERE (SELECT ma_khach_hang FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) <> NEW.ma_khach_hang;
  SELECT RAISE(ABORT,'Đơn không ở trạng thái được phép đổi tour')
    WHERE (SELECT trang_thai FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky)
          NOT IN ('cho_xac_nhan','da_xac_nhan');
  SELECT RAISE(ABORT,'Khởi hành cũ không khớp với đơn')
    WHERE (SELECT ma_khoi_hanh FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) <> NEW.ma_khoi_hanh_cu;
  SELECT RAISE(ABORT,'Khởi hành mới không mở bán hoặc đã qua ngày')
    WHERE (SELECT trang_thai FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi) <> 'mo_ban'
       OR (SELECT ngay_khoi_hanh FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi) < date('now','localtime');
  SELECT RAISE(ABORT,'Tour mới đã ngừng hoạt động')
    WHERE (SELECT t.trang_thai FROM tour t JOIN khoi_hanh k ON k.ma_tour = t.ma_tour
           WHERE k.ma_khoi_hanh = NEW.ma_khoi_hanh_moi) <> 'hoat_dong';
  SELECT RAISE(ABORT,'Khởi hành mới không đủ chỗ')
    WHERE (SELECT so_nguoi_lon + so_tre_em FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) >
          (SELECT cho_con FROM v_cho_con WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi);
  -- Chênh lệch phải đúng = tổng theo giá khởi hành mới - tổng hiện tại
  SELECT RAISE(ABORT,'Chênh lệch sai: phải bằng tổng tiền theo giá khởi hành mới trừ tổng tiền hiện tại')
    WHERE NEW.chenh_lech <> (
      SELECT p.so_nguoi_lon * k.gia_nguoi_lon + p.so_tre_em * k.gia_tre_em - p.tong_tien
        FROM phieu_dang_ky p, khoi_hanh k
       WHERE p.so_phieu_dang_ky = NEW.so_phieu_dang_ky AND k.ma_khoi_hanh = NEW.ma_khoi_hanh_moi);
  -- Quy tắc nghiệp vụ đổi tour (ngưỡng nằm trong cau_hinh)
  SELECT RAISE(ABORT,'Đơn này đã đổi tour một lần, không được đổi nữa')
    WHERE (SELECT da_doi_tour FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky) = 1;
  SELECT RAISE(ABORT,'Quá hạn đổi tour: chỉ được đổi trong N ngày kể từ ngày đặt')
    WHERE julianday(date(NEW.ngay_doi)) -
          julianday(date((SELECT ngay_dang_ky FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky)))
          > (SELECT CAST(gia_tri AS INTEGER) FROM cau_hinh WHERE khoa = 'so_ngay_toi_da_doi_tour_sau_khi_dat');
  SELECT RAISE(ABORT,'Tour mới phải khởi hành sau ngày đổi ít nhất N ngày')
    WHERE julianday((SELECT ngay_khoi_hanh FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi))
          - julianday(date(NEW.ngay_doi))
          < (SELECT CAST(gia_tri AS INTEGER) FROM cau_hinh WHERE khoa = 'so_ngay_toi_thieu_tu_ngay_doi_den_khoi_hanh_moi');
END;

CREATE TRIGGER trg_doi_ai AFTER INSERT ON phieu_doi_tour
BEGIN
  UPDATE phieu_dang_ky
     SET ma_khoi_hanh      = NEW.ma_khoi_hanh_moi,
         don_gia_nguoi_lon = (SELECT gia_nguoi_lon FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi),
         don_gia_tre_em    = (SELECT gia_tre_em    FROM khoi_hanh WHERE ma_khoi_hanh = NEW.ma_khoi_hanh_moi),
         tong_tien         = tong_tien + NEW.chenh_lech,
         da_doi_tour       = 1
   WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky;
  -- Đồng bộ hóa đơn: chênh lệch dương => con_phai_thu, âm => can_hoan (xem v_cong_no)
  UPDATE hoa_don
     SET tong_tien = (SELECT tong_tien FROM phieu_dang_ky WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky)
   WHERE so_phieu_dang_ky = NEW.so_phieu_dang_ky;
END;

-- ---------------------------------------------------------------
-- TRIGGER  –  ĐÁNH GIÁ & XÓA DỮ LIỆU
-- ---------------------------------------------------------------
CREATE TRIGGER trg_dg_bi BEFORE INSERT ON danh_gia
BEGIN
  SELECT RAISE(ABORT,'Chỉ được đánh giá khi đơn của chính bạn đã hoàn thành')
    WHERE NOT EXISTS (SELECT 1 FROM phieu_dang_ky p JOIN khoi_hanh k ON k.ma_khoi_hanh = p.ma_khoi_hanh
                      WHERE p.so_phieu_dang_ky = NEW.so_phieu_dang_ky
                        AND p.ma_khach_hang = NEW.ma_khach_hang
                        AND k.ma_tour = NEW.ma_tour
                        AND p.trang_thai = 'hoan_thanh');
END;
CREATE TRIGGER trg_tour_no_delete BEFORE DELETE ON tour
BEGIN
  SELECT RAISE(ABORT,'Tour đã có khởi hành, chỉ được chuyển sang trạng thái ngừng')
    WHERE EXISTS (SELECT 1 FROM khoi_hanh WHERE ma_tour = OLD.ma_tour);
END;
CREATE TRIGGER trg_kh_no_delete BEFORE DELETE ON khoi_hanh
BEGIN
  SELECT RAISE(ABORT,'Khởi hành đã có đơn đăng ký, chỉ được đóng hoặc hủy')
    WHERE EXISTS (SELECT 1 FROM phieu_dang_ky WHERE ma_khoi_hanh = OLD.ma_khoi_hanh);
END;
CREATE TRIGGER trg_pdk_no_delete BEFORE DELETE ON phieu_dang_ky
BEGIN SELECT RAISE(ABORT,'Không xóa đơn đăng ký, hãy hủy đơn'); END;

-- ---------------------------------------------------------------
-- DỮ LIỆU KHỞI TẠO TỐI THIỂU

-- ---------------------------------------------------------------
INSERT INTO vai_tro VALUES
 ('ADMIN','Quản trị viên','Toàn quyền hệ thống'),
 ('DIEU_HANH','Điều hành tour','Quản lý tour, khởi hành, đơn đặt, nhà cung cấp'),
 ('CSKH','Chăm sóc khách hàng','Quản lý khách hàng, đơn đặt, đánh giá'),
 ('KE_TOAN','Kế toán','Thanh toán, hóa đơn, báo cáo');

INSERT INTO quyen VALUES
 ('TOUR_MANAGE','Quản lý tour'),('BOOKING_MANAGE','Quản lý đơn đặt tour'),
 ('CUSTOMER_MANAGE','Quản lý khách hàng'),('PAYMENT_MANAGE','Quản lý thanh toán'),
 ('EMPLOYEE_MANAGE','Quản lý nhân viên'),('SUPPLIER_MANAGE','Quản lý nhà cung cấp'),
 ('REPORT_VIEW','Xem báo cáo & thống kê'),('SYSTEM_CONFIG','Quản lý hệ thống');

INSERT INTO vai_tro_quyen SELECT 'ADMIN', ma_quyen FROM quyen;
INSERT INTO vai_tro_quyen VALUES
 ('DIEU_HANH','TOUR_MANAGE'),('DIEU_HANH','BOOKING_MANAGE'),('DIEU_HANH','SUPPLIER_MANAGE'),
 ('CSKH','CUSTOMER_MANAGE'),('CSKH','BOOKING_MANAGE'),
 ('KE_TOAN','PAYMENT_MANAGE'),('KE_TOAN','REPORT_VIEW');

INSERT INTO cau_hinh VALUES
 ('gio_huy_toi_thieu_truoc_khoi_hanh','72','Số giờ tối thiểu trước ngày đi để được hủy/đổi tour'),
 ('tuoi_tre_em_toi_da','11','Tuổi tối đa tính giá trẻ em'),
 ('so_lan_doi_tour_toi_da','1','Số lần đổi tour tối đa cho mỗi đơn');
INSERT INTO cau_hinh VALUES
 ('so_ngay_toi_da_doi_tour_sau_khi_dat','5','Chỉ được đổi tour trong N ngày kể từ ngày đặt'),
 ('so_ngay_toi_thieu_tu_ngay_doi_den_khoi_hanh_moi','7','Tour mới phải khởi hành sau ngày đổi ít nhất N ngày');
