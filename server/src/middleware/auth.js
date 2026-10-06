const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireAuth(roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập.' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (roles && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập.' });
      }
      req.user = payload; // { role: 'customer'|'employee', id, isAdmin }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
  };
}

// Kiểm tra nhân viên có quyền (ma_quyen) cụ thể hay không, dựa trên bảng vai_tro_quyen.
// ADMIN mặc định có mọi quyền (đã được gán đủ quyền khi seed dữ liệu).
function requirePermission(permission) {
  const db = require('../db');
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'employee') return res.status(403).json({ error: 'Không có quyền truy cập.' });
    const row = db.prepare(
      'SELECT 1 FROM vai_tro_quyen WHERE ma_vai_tro = ? AND ma_quyen = ?'
    ).get(req.user.vaiTro, permission);
    if (!row) return res.status(403).json({ error: 'Tài khoản của bạn không có quyền thực hiện thao tác này.' });
    next();
  };
}

module.exports = { requireAuth, requirePermission };
