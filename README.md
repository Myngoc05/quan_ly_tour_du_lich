# TravelGo — Website quản lý tour du lịch (phiên bản schema đầy đủ)

Đây là bản làm lại hoàn toàn backend của TravelGo để khớp **chính xác** với file
`travelgo_schema_v2.sql` bạn cung cấp (đúng tên bảng, đúng ràng buộc, đúng toàn bộ
23 trigger và 5 view). Giao diện giữ phong cách tương tự bản trước nhưng được viết lại
để phù hợp với luồng nghiệp vụ mới (chọn khởi hành riêng với tour, khai báo hành khách,
hóa đơn tách khỏi sổ giao dịch, đổi tour do nhân viên lập...).

## 1. Điểm khác biệt quan trọng so với bản trước

| Trước đây | Bây giờ (theo schema mới) |
|---|---|
| 1 tour = 1 giá, 1 ngày khởi hành | 1 **tour** (thông tin chung) có nhiều **khởi hành** (`khoi_hanh`), mỗi khởi hành có giá/ngày/số chỗ riêng |
| Đặt tour xong là coi như xong | Phải khai báo đủ **hành khách** (`hanh_khach`) khớp số người lớn/trẻ em thì nhân viên mới xác nhận được |
| Hóa đơn = thanh toán | Tách riêng **hóa đơn** (`hoa_don`, số tiền phải trả) và **sổ giao dịch** (`thanh_toan`, có thể thu nhiều lần / hoàn tiền) |
| Khách tự "yêu cầu đổi tour" | **Nhân viên lập phiếu đổi tour** (`phieu_doi_tour`) khi khách liên hệ hỗ trợ — đúng thiết kế NOT NULL `ma_nhan_vien` trong schema |
| Phân quyền đơn giản (is_admin) | Hệ thống **vai trò & quyền** đầy đủ (`vai_tro`, `quyen`, `vai_tro_quyen`): ADMIN / DIEU_HANH / CSKH / KE_TOAN, mỗi vai trò chỉ thấy đúng mục mình có quyền |
| Validate ở code backend | Validate chủ yếu ở **trigger trong chính CSDL** — an toàn hơn vì không thể lách qua API, đúng tinh thần đồ án CSDL |

## 2. File schema

`server/src/schema.sql` là **nguyên văn** file bạn gửi, không chỉnh sửa gì. `db.js` chỉ
đọc và chạy file này khi khởi tạo CSDL lần đầu, sau đó seed dữ liệu mẫu.

> Lưu ý kỹ thuật: để chèn được dữ liệu LỊCH SỬ (các đơn đã hoàn thành ở quá khứ, phục vụ
> biểu đồ báo cáo), `db.js` tạm gỡ toàn bộ trigger, chèn dữ liệu, rồi **khôi phục nguyên
> văn đoạn SQL định nghĩa trigger** từ chính file schema.sql. Mọi thao tác CRUD thật của
> người dùng qua API đều đi qua đầy đủ 23 trigger như thiết kế gốc.

## 3. Tài khoản demo

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Khách hàng | ngoc@mail.com | 123456 |
| Quản trị viên (ADMIN) | admin@travelgo.vn | admin123 |
| Điều hành tour (DIEU_HANH) | nam@travelgo.vn | 123456 |
| Chăm sóc khách hàng (CSKH) | mai@travelgo.vn | 123456 |
| Kế toán — tài khoản nghỉ việc, **không đăng nhập được** (để demo) | khoa@travelgo.vn | 123456 |

## 4. Chạy thử

```bash
cd server
npm install
cp .env.example .env
npm start
```
Mở `http://localhost:4000`.

## 5. Luồng nghiệp vụ chính đã cài đặt & kiểm thử

1. **Khách đặt tour**: chọn tour → chọn 1 khởi hành cụ thể → nhập số người lớn/trẻ em →
   tạo phiếu đăng ký (`cho_xac_nhan`). CSDL tự chặn nếu: khởi hành đã đóng bán, tour ngừng
   hoạt động, ngày khởi hành đã qua, hoặc không đủ chỗ.
2. **Khai báo hành khách**: khách (hoặc nhân viên) thêm từng hành khách. Trigger chặn nếu
   thêm vượt quá số người lớn/trẻ em đã đăng ký, hoặc đơn không còn ở trạng thái chờ xác nhận.
3. **Nhân viên xác nhận đơn**: chỉ xác nhận được khi hành khách đã khai đủ. Hệ thống tự
   tạo hóa đơn.
4. **Thanh toán**: khách (hoặc nhân viên) ghi nhận một hoặc nhiều lần "thu" vào hóa đơn.
   Trigger chặn nếu thu vượt quá số tiền còn phải trả.
5. **Hoàn thành**: nhân viên đánh dấu hoàn thành — CSDL chặn nếu chưa tới ngày khởi hành
   hoặc chưa thanh toán đủ.
6. **Hủy đơn**: do nhân viên thực hiện, quyết định phí hủy. Đơn **đã hoàn thành không thể
   hủy** (không có trạng thái cho phép).
7. **Đổi tour**: nhân viên lập phiếu đổi tour cho đơn đã xác nhận; hệ thống tự tính và
   hiển thị chênh lệch tiền (thu thêm / hoàn lại), CSDL CHECK đúng công thức.
8. **Đánh giá**: khách chỉ đánh giá được đơn đã **hoàn thành**, mỗi đơn chỉ đánh giá 1 lần
   (ràng buộc UNIQUE).
9. **Phân quyền**: mỗi vai trò nhân viên chỉ nhìn thấy đúng các mục trong sidebar mà vai
   trò đó có quyền (bảng `vai_tro_quyen`); chỉ ADMIN thêm được nhân viên mới.

Toàn bộ các luồng trên đã được kiểm thử trực tiếp qua API (kể cả các trường hợp CSDL phải
từ chối) trước khi đóng gói gửi bạn.

## 6. Những phần có thể cần bạn bổ sung thêm cho đồ án

- **Đặt hẹn giờ giữ chỗ** (`han_giu_cho` trong `phieu_dang_ky`): cột đã có trong schema
  nhưng chưa có job tự động nhả chỗ khi hết hạn — hiện đơn "chờ xác nhận" giữ chỗ vô thời hạn.
- **Hình ảnh tour thật** (`tour_hinh_anh`): bảng đã tạo nhưng chưa có upload file, đang
  dùng khối màu minh họa.
- **Nhật ký thao tác** (`nhat_ky` nếu có trong schema mở rộng sau này) và **cấu hình hệ
  thống qua giao diện** (bảng `cau_hinh` đang đọc trực tiếp, UI chỉnh sửa thông số nghiệp
  vụ cho mục "15. Quản lý hệ thống" chưa làm).
- Email xác nhận/hóa đơn tự động chưa nối dịch vụ SMTP thật.

## 7. Triển khai thật

Giống hướng dẫn bản trước: deploy `server/` lên Railway/Render (Root Directory: `server`,
Build: `npm install`, Start: `npm start`), nhớ gắn ổ đĩa lưu trữ lâu dài cho file SQLite,
và đổi `JWT_SECRET` + mật khẩu admin mặc định trong biến môi trường trước khi dùng thật.
