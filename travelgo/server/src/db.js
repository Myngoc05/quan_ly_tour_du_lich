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

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cccd TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  address TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  is_locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  dob TEXT,
  address TEXT,
  position TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  is_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  contract_price INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id),
  customer_id TEXT,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tours (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  from_place TEXT,
  to_place TEXT,
  duration TEXT,
  cost INTEGER NOT NULL,
  old_cost INTEGER DEFAULT 0,
  depart_date TEXT NOT NULL,
  seats INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  schedule TEXT DEFAULT '[]',
  image_seed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  booking_date TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  tour_id TEXT NOT NULL REFERENCES tours(id),
  qty INTEGER NOT NULL,
  adults INTEGER NOT NULL,
  children INTEGER DEFAULT 0,
  vehicle TEXT,
  hotel TEXT,
  depart_date TEXT NOT NULL,
  depart_time TEXT,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'wait',
  changed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
  invoice_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT DEFAULT 'QR'
);

CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  invoice_id TEXT,
  customer_id TEXT NOT NULL,
  change_date TEXT NOT NULL,
  old_tour_id TEXT NOT NULL,
  new_tour_id TEXT NOT NULL
);
`);

// Seed dữ liệu mẫu nếu database còn trống
const tourCount = db.prepare('SELECT COUNT(*) c FROM tours').get().c;
if (tourCount === 0) {
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const insTour = db.prepare(`INSERT INTO tours (id,name,region,from_place,to_place,duration,cost,old_cost,depart_date,seats,status,schedule,image_seed)
    VALUES (@id,@name,@region,@from_place,@to_place,@duration,@cost,@old_cost,@depart_date,@seats,'active',@schedule,@image_seed)`);
  const sampleTours = [
    { id: 'T001', name: 'Đà Nẵng - Hội An - Bà Nà', region: 'trongnuoc', from_place: 'TP.HCM', to_place: 'Đà Nẵng', duration: '4 ngày 3 đêm', cost: 5990000, old_cost: 7500000, depart_date: addDays(20), seats: 24, image_seed: 0,
      schedule: JSON.stringify(['Ngày 1: Đà Nẵng - Ngũ Hành Sơn - Hội An', 'Ngày 2: Hội An - Bà Nà Hills', 'Ngày 3: Tự do tắm biển Mỹ Khê', 'Ngày 4: Tiễn sân bay']) },
    { id: 'T002', name: 'Phú Quốc Nghỉ Dưỡng', region: 'trongnuoc', from_place: 'TP.HCM', to_place: 'Phú Quốc', duration: '3 ngày 2 đêm', cost: 4990000, old_cost: 0, depart_date: addDays(25), seats: 30, image_seed: 1,
      schedule: JSON.stringify(['Ngày 1: Đón sân bay - Nghỉ dưỡng resort', 'Ngày 2: Tour 4 đảo Nam Phú Quốc', 'Ngày 3: Chợ đêm - Tiễn sân bay']) },
    { id: 'T003', name: 'Singapore - Malaysia', region: 'nuocngoai', from_place: 'TP.HCM', to_place: 'Singapore', duration: '5 ngày 4 đêm', cost: 12990000, old_cost: 0, depart_date: addDays(30), seats: 12, image_seed: 2,
      schedule: JSON.stringify(['Ngày 1: Khởi hành - Singapore', 'Ngày 2: Gardens by the Bay', 'Ngày 3: Sang Malaysia', 'Ngày 4: Kuala Lumpur city tour', 'Ngày 5: Về nước']) },
    { id: 'T004', name: 'Bangkok - Pattaya', region: 'nuocngoai', from_place: 'TP.HCM', to_place: 'Bangkok', duration: '5 ngày 4 đêm', cost: 11990000, old_cost: 0, depart_date: addDays(22), seats: 18, image_seed: 3,
      schedule: JSON.stringify(['Ngày 1: Khởi hành - Bangkok', 'Ngày 2: Chùa Vàng - Cung điện', 'Ngày 3: Pattaya - đảo Coral', 'Ngày 4: Chợ nổi', 'Ngày 5: Về nước']) },
    { id: 'T005', name: 'Sapa - Fansipan', region: 'trongnuoc', from_place: 'Hà Nội', to_place: 'Sapa', duration: '3 ngày 2 đêm', cost: 4590000, old_cost: 0, depart_date: addDays(18), seats: 9, image_seed: 4,
      schedule: JSON.stringify(['Ngày 1: Hà Nội - Sapa', 'Ngày 2: Chinh phục Fansipan', 'Ngày 3: Bản Cát Cát - về Hà Nội']) },
  ];
  const insertMany = db.transaction(rows => rows.forEach(r => insTour.run(r)));
  insertMany(sampleTours);

  // Khách hàng demo
  db.prepare(`INSERT INTO customers (id,name,cccd,email,phone,address,password_hash) VALUES (?,?,?,?,?,?,?)`)
    .run('KH001', 'Nguyễn Thị Ngọc', '079123456789', 'ngoc@mail.com', '0901234567', 'Q1, TP.HCM', bcrypt.hashSync('123456', 10));

  // Nhà cung cấp mẫu
  const insSupplier = db.prepare(`INSERT INTO suppliers (id,name,type,contact_name,phone,email,contract_price,status) VALUES (?,?,?,?,?,?,?,'active')`);
  [
    ['NCC001', 'Khách sạn Mường Thanh Đà Nẵng', 'Khách sạn', 'Nguyễn Văn Khách', '0905111222', 'sales@muongthanh.vn', 850000],
    ['NCC002', 'Nhà xe Phương Trang', 'Vận chuyển', 'Trần Thị Xe', '0909222333', 'lienhe@futabus.vn', 300000],
    ['NCC003', 'Vietjet Air', 'Vé máy bay', 'Lê Văn Bay', '1900 1886', 'corp@vietjetair.com', 1200000],
    ['NCC004', 'Nhà hàng Hải Sản Biển Đông', 'Nhà hàng', 'Phạm Thị Hải', '0918333444', 'contact@biendong.vn', 250000],
  ].forEach(r => insSupplier.run(...r));

  // Đánh giá mẫu cho vài tour
  const insReview = db.prepare(`INSERT INTO reviews (id,tour_id,customer_id,reviewer_name,rating,comment,created_at) VALUES (?,?,?,?,?,?,?)`);
  [
    ['RV001', 'T001', 'KH001', 'Nguyễn Thị Ngọc', 5, 'Dịch vụ rất tốt, hướng dẫn viên nhiệt tình, cảnh đẹp!', addDays(-10)],
    ['RV002', 'T001', null, 'Trần Văn Nam', 5, 'Lịch trình hợp lý, khách sạn sạch sẽ.', addDays(-20)],
    ['RV003', 'T001', null, 'Lê Thị Mai', 4, 'Tour ổn, đồ ăn hơi ít lựa chọn.', addDays(-30)],
    ['RV004', 'T002', null, 'Phạm Văn Hùng', 5, 'Biển đẹp, resort xịn, sẽ quay lại.', addDays(-15)],
    ['RV005', 'T003', null, 'Hoàng Thị Lan', 4, 'Singapore sạch đẹp, giá hơi cao.', addDays(-5)],
  ].forEach(r => insReview.run(...r));

  // Thêm vài nhân viên demo với chức vụ/trạng thái khác nhau
  const insEmp = db.prepare(`INSERT INTO employees (id,name,phone,gender,dob,address,position,email,password_hash,is_admin,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  [
    ['NV002', 'Trần Văn Nam', '0912345678', 'Nam', '1995-02-10', 'Q7, TP.HCM', 'Điều hành tour', 'nam@travelgo.vn', bcrypt.hashSync('123456', 10), 0, 1],
    ['NV003', 'Lê Thị Mai', '0987654321', 'Nữ', '1997-06-20', 'Q2, TP.HCM', 'CSKH', 'mai@travelgo.vn', bcrypt.hashSync('123456', 10), 0, 1],
    ['NV004', 'Đỗ Minh Khoa', '0988887777', 'Nam', '1996-09-15', 'Q9, TP.HCM', 'IT', 'khoa@travelgo.vn', bcrypt.hashSync('123456', 10), 0, 0],
  ].forEach(r => { try { insEmp.run(...r); } catch (e) {} });

  // Booking + hóa đơn lịch sử mẫu (các tháng trước) để Báo cáo & Tài chính có dữ liệu minh họa
  const methods = ['Ví điện tử', 'Thẻ ATM', 'Chuyển khoản', 'Tiền mặt'];
  const histTourIds = ['T001', 'T002', 'T003', 'T004', 'T005'];
  const insB = db.prepare(`INSERT INTO bookings (id,booking_date,customer_id,tour_id,qty,adults,children,vehicle,hotel,depart_date,depart_time,total,status,changed)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'paid',0)`);
  const insInv = db.prepare(`INSERT INTO invoices (id,employee_id,booking_id,invoice_date,amount,payment_method) VALUES (?,?,?,?,?,?)`);
  for (let m = 11; m >= 0; m--) {
    const count = 4 + (m % 5); // số đơn minh họa mỗi tháng
    for (let k = 0; k < count; k++) {
      const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(2 + k);
      const dateStr = d.toISOString().slice(0, 10);
      const tourId = histTourIds[(m + k) % histTourIds.length];
      const tour = sampleTours.find(t => t.id === tourId);
      const qty = 1 + (k % 4);
      const total = qty * tour.cost;
      const bId = 'PDKH' + m + '' + k;
      insB.run(bId, dateStr, 'KH001', tourId, qty, qty, 0, 'Xe khách', '3 sao', addDays(5), '06:00', total);
      insInv.run('HDH' + m + '' + k, 'NV001', bId, dateStr, total, methods[(m + k) % methods.length]);
    }
  }
}

// Đảm bảo luôn có 1 tài khoản admin (nhân viên có is_admin=1) theo .env
const adminEmail = process.env.ADMIN_EMAIL || 'admin@travelgo.vn';
const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
const existingAdmin = db.prepare('SELECT id FROM employees WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  db.prepare(`INSERT INTO employees (id,name,phone,gender,dob,address,position,email,password_hash,is_admin)
    VALUES (?,?,?,?,?,?,?,?,?,1)`)
    .run('NV001', 'Quản trị viên', '0912345678', 'Nữ', '1998-04-12', 'Q3, TP.HCM', 'Quản trị hệ thống', adminEmail, bcrypt.hashSync(adminPass, 10));
}

module.exports = db;
