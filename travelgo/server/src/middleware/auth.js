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

module.exports = { requireAuth };
