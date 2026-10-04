require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // đảm bảo DB được khởi tạo/seed trước khi mount route

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tours', require('./routes/tours'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/changes', require('./routes/changes'));
app.use('/api', require('./routes/people'));       // /api/customers, /api/employees
app.use('/api/stats', require('./routes/stats'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api', require('./routes/reviews'));       // /api/tours/:id/reviews, /api/my-reviews

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Phục vụ frontend tĩnh
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`TravelGo server đang chạy tại cổng ${PORT}`));
