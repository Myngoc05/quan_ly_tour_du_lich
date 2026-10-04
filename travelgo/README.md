# TravelGo — Website quản lý tour du lịch

Website đầy đủ chức năng cho công ty du lịch: khách hàng xem/đặt tour, thanh toán online,
yêu cầu đổi tour; quản trị viên quản lý tour, booking, khách hàng, tài chính và nhân sự.

Đây là một ứng dụng **thật** (có backend + cơ sở dữ liệu), không phải bản demo chạy trong
trình duyệt — dữ liệu được lưu lại vĩnh viễn và nhiều người có thể dùng cùng lúc.

## 1. Công nghệ sử dụng

- **Backend:** Node.js + Express
- **Cơ sở dữ liệu:** SQLite (file, không cần cài đặt server DB riêng — phù hợp để bắt đầu nhanh,
  gọn nhẹ, dễ deploy miễn phí; có thể nâng cấp lên PostgreSQL khi cần mở rộng)
- **Xác thực:** JWT + mật khẩu băm bằng bcrypt
- **Frontend:** HTML/CSS/JavaScript thuần (1 trang, gọi API qua `fetch`), không cần bước build

## 2. Cấu trúc thư mục

```
server/
  src/
    server.js        # điểm khởi động Express
    db.js             # kết nối SQLite + tạo bảng + seed dữ liệu mẫu
    utils.js
    middleware/auth.js
    routes/
      auth.js         # đăng ký / đăng nhập
      tours.js        # quản lý tour (CRUD)
      bookings.js      # đặt tour, xác nhận (có ràng buộc 15 ngày, số chỗ)
      payments.js      # thanh toán QR (mô phỏng) + chỗ sẵn tích hợp VNPay/Momo thật
      changes.js       # yêu cầu đổi tour (ràng buộc 5/7 ngày, 1 lần)
      people.js        # khách hàng (CRM) + nhân viên
      stats.js         # dashboard, hóa đơn
  public/
    index.html         # toàn bộ giao diện, gọi API qua fetch()
  package.json
  .env.example
```

## 3. Chạy thử trên máy của bạn

Yêu cầu: đã cài **Node.js 18 trở lên**.

```bash
cd server
npm install
cp .env.example .env
npm start
```

Mở trình duyệt tại `http://localhost:4000`.

Tài khoản có sẵn để test:
- Khách hàng: `ngoc@mail.com` / `123456`
- Quản trị viên: `admin@travelgo.vn` / `admin123` (đổi trong file `.env` trước khi deploy thật)

## 4. Triển khai miễn phí lên Railway hoặc Render

### Cách chung
1. Đưa toàn bộ thư mục `server/` lên một repository GitHub (repo riêng, hoặc repo chứa cả thư mục `server/` ở gốc).
2. Trên Railway/Render, tạo **Web Service** mới, kết nối tới repo đó.
3. Cấu hình:
   - **Root Directory:** `server` (nếu repo của bạn có nhiều thư mục, trỏ đúng vào thư mục `server`)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Thêm **biến môi trường** (Environment Variables) theo file `.env.example`, quan trọng nhất:
   - `JWT_SECRET` — đổi thành chuỗi ngẫu nhiên dài, giữ bí mật
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — tài khoản quản trị đầu tiên
   - `DB_PATH` — ví dụ `/data/travelgo.db`
5. **Quan trọng — lưu dữ liệu lâu dài:** SQLite lưu vào 1 file, nếu server bị khởi động lại
   trên ổ đĩa tạm thì dữ liệu sẽ mất. Hãy gắn một **Persistent Volume/Disk** (Railway: mục
   "Volumes"; Render: mục "Disks") và trỏ `DB_PATH` vào đường dẫn trong volume đó
   (ví dụ `/data/travelgo.db`).
6. Sau khi deploy xong, Railway/Render sẽ cấp cho bạn 1 domain dạng
   `ten-du-an.up.railway.app` hoặc `ten-du-an.onrender.com` — vào ngay để đổi mật khẩu admin mặc định.

Khi công ty phát triển hơn và cần dữ liệu quy mô lớn/nhiều server cùng truy cập, có thể thay
SQLite bằng PostgreSQL (Railway/Render đều có sẵn add-on PostgreSQL miễn phí ở mức nhỏ).

## 5. Nối cổng thanh toán thật (VNPay / Momo)

Hiện tại nút "Xác nhận đã quét & thanh toán" đang **mô phỏng** (không có tiền thật di chuyển),
để bạn dùng thử toàn bộ luồng nghiệp vụ ngay. File `src/routes/payments.js` có ghi chú chi tiết
chỗ cần thay bằng lời gọi API thật khi công ty có tài khoản merchant:

- Điền `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` (hoặc `MOMO_*`) vào biến môi trường
- Viết hàm tạo URL thanh toán có chữ ký theo tài liệu của VNPay/Momo
- Chỉ đánh dấu đơn là "đã thanh toán" **sau khi** server xác thực callback (IPN/webhook) từ
  cổng thanh toán thật — không đánh dấu ngay từ phía trình duyệt, để tránh gian lận.

## 6. Gửi email hóa đơn tự động (trong vòng 24 giờ theo quy định)

Hiện chưa nối dịch vụ email thật. Trong `src/routes/payments.js` và `src/routes/changes.js`
có đánh dấu `TODO` ở đúng chỗ cần gọi:
- **Nodemailer** + tài khoản SMTP công ty, hoặc
- Dịch vụ email API như **Resend** hoặc **SendGrid** (có gói miễn phí)

## 7. Chức năng vừa được bổ sung (cập nhật mới nhất)

- **Nhà cung cấp**: CRUD khách sạn/nhà hàng/vận chuyển/vé máy bay (`routes/suppliers.js`)
- **Báo cáo & thống kê**: trang riêng với bộ lọc khoảng thời gian (7 ngày/30 ngày/3 tháng/1 năm),
  biểu đồ doanh thu theo tháng, biểu đồ tỷ lệ đơn theo tour, bảng tổng hợp theo tour
  (dùng thư viện Chart.js tải qua CDN, không cần cài thêm gì)
- **Thanh toán & tài chính**: trang riêng với biểu đồ doanh thu + biểu đồ phương thức thanh toán
  + danh sách giao dịch có phân trang
- **Quản lý nhân sự**: thêm trạng thái Hoạt động/Ngừng hoạt động, cột Quyền (Admin/Nhân viên),
  quản trị viên có thể tạm ngừng tài khoản nhân viên khác
- **Quản lý khách hàng (CRM)**: thêm khóa/mở khóa tài khoản khách hàng (tài khoản bị khóa sẽ
  không đăng nhập được), ô tìm kiếm theo tên/SĐT/email
- **Quản lý tour**: thêm bộ lọc (điểm đến, loại tour, trạng thái chỗ), trạng thái
  Còn chỗ/Sắp hết/Hết chỗ tự tính theo số chỗ còn lại, và chức năng **Sửa tour**
- **Quản lý booking**: thêm bộ lọc theo ngày/tour/trạng thái và chức năng **Hủy đơn**
  (chỉ áp dụng cho đơn chưa thanh toán, đúng ràng buộc nghiệp vụ)
- **Đánh giá tour**: khách hàng đã thanh toán có thể đánh giá sao + nhận xét; trang chi tiết
  tour hiển thị rating trung bình, số đánh giá, số lượt đặt, % giảm giá, và các tab
  Lịch trình / Giá & Dịch vụ / Điều khoản / Đánh giá
- **Trang chủ**: thêm hàng 4 điểm nổi bật (USP), hiển thị rating/lượt đặt trên thẻ tour
- **Header**: thêm icon tìm kiếm nhanh và chuông thông báo (hiện là thông báo tĩnh minh họa —
  xem mục 9 để biết cách nâng cấp thành thông báo thời gian thực)
- **Chọn phương thức thanh toán**: khi xác nhận thanh toán, khách hàng chọn Ví điện tử/Thẻ ATM/
  Chuyển khoản/Tiền mặt để phục vụ thống kê tỷ trọng phương thức thanh toán

## 8. Giới hạn hiện tại (minh bạch để bạn biết rõ)

- **Chuông thông báo** ở header hiện hiển thị nội dung tĩnh minh họa, chưa nối với một bảng
  "notifications" thật trong database. Muốn làm thật: tạo bảng `notifications`, ghi sự kiện
  (đặt tour mới, thanh toán, đổi tour...) vào đó, rồi gọi API lấy thông báo theo từng người dùng.
- **Ảnh tour** vẫn là khối màu minh họa (gradient), chưa có tải ảnh thật lên. Muốn thêm:
  dùng `multer` để nhận file upload ở backend, lưu vào thư mục `public/uploads` hoặc dịch vụ
  lưu trữ đám mây (Cloudinary, S3), rồi lưu đường dẫn ảnh vào cột `image_url` của bảng `tours`.
- **Biểu đồ "Doanh thu theo tháng"** trong trang Báo cáo luôn hiển thị 12 tháng gần nhất bất kể
  nút khoảng thời gian bạn chọn; riêng các thẻ số liệu và bảng tổng hợp theo tour thì có thay đổi
  theo đúng khoảng thời gian đã chọn.
- Đăng ký/sửa thông tin cá nhân chưa gửi email xác thực — xem mục 6 để nối dịch vụ email thật.

## 9. Các ràng buộc nghiệp vụ đã được cài đặt sẵn trong backend

| Ràng buộc | Vị trí xử lý |
|---|---|
| Đặt tour phải trước ≥ 15 ngày so với ngày khởi hành | `routes/bookings.js` |
| Số lượng người đăng ký ≤ số chỗ còn trống | `routes/bookings.js` |
| Tour đã thanh toán không được hủy | `routes/bookings.js` — route `/cancel` từ chối nếu status='paid' |
| Khách hàng bị khóa / nhân viên ngừng hoạt động không đăng nhập được | `routes/auth.js` |
| Chỉ khách hàng đã thanh toán tour mới được đánh giá | `routes/reviews.js` |
| Đổi tour: trong 5 ngày sau đặt và trước 7 ngày so với ngày khởi hành mới | `routes/changes.js` |
| Mỗi đơn chỉ được đổi tour 1 lần | `routes/changes.js` |
| CCCD / Email / SĐT không trùng lặp | `routes/auth.js`, DB constraint `UNIQUE` |
| Chỉ nhân viên mới thêm/sửa/xóa tour, xác nhận booking | middleware `requireAuth(['employee'])` |
| Chỉ quản trị viên mới thêm nhân viên mới | kiểm tra `req.user.isAdmin` trong `routes/people.js` |

## 8. Việc cần làm trước khi vận hành thật (khuyến nghị)

- [ ] Đổi `JWT_SECRET` và mật khẩu admin mặc định
- [ ] Gắn Persistent Volume cho SQLite (hoặc chuyển sang PostgreSQL)
- [ ] Tích hợp cổng thanh toán thật (mục 5)
- [ ] Tích hợp gửi email thật (mục 6)
- [ ] Thêm HTTPS (Railway/Render tự cấp sẵn theo domain của họ)
- [ ] Sao lưu (backup) định kỳ file database
