require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tours', require('./routes/tours'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api', require('./routes/payments'));    // /api/hoa-don, /api/thanh-toan
app.use('/api/phieu-doi-tour', require('./routes/changes'));
app.use('/api', require('./routes/reviews'));     // /api/tours/:id/danh-gia, /api/danh-gia
app.use('/api', require('./routes/people'));      // /api/khach-hang, /api/nhan-vien, /api/vai-tro
app.use('/api', require('./routes/suppliers'));   // /api/nha-cung-cap, /api/dich-vu
app.use('/api/thong-ke', require('./routes/stats'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`TravelGo server đang chạy tại cổng ${PORT}`));
