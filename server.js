// server.js - CLEAN VERSION
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

app.set('io', io);

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Import Database Pool (with correct charset)
const dbPool = require('./config/db');

// ====================== ROUTES ======================
const obRoutes = require('./route/obRoute');
app.use('/api/ob', obRoutes);

const allRoutes = require('./route');
app.use('/api', allRoutes);

// Dashboard Route Example
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [clients] = await dbPool.query('SELECT COUNT(*) as total FROM clients');
    const [staff] = await dbPool.query('SELECT COUNT(*) as total FROM users');
    
    res.json({
      totalClients: clients[0].total,
      totalStaff: staff[0].total,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.originalUrl}` 
  });
});
// ==================== SOCKET.IO EVENTS ====================
io.on('connection', (socket) => {

  // === Existing Advance Socket ===
  socket.on('initiate-advance-window', (data) => {
    const { initiationDate, month, year, monthName } = data;
    console.log(`✅ Advance window initiated for ${monthName} ${year}`);
    io.emit('advance-window-initiated', {
      initiationDate,
      month,
      year,
      monthName
    });
  });

  // === NEW: Visitor Badge Socket (MySQL) ===
  socket.on('visitor-badge-generated', async (data) => {
    try {
      const { badge, targetRole, message, host, timestamp } = data;

      console.log(`🔔 New Visitor Badge: ${badge.visitorName} → ${badge.hostOffice}`);

      // Save to MySQL
      const sql = `
        INSERT INTO visitor_badges 
        (badge_id, visitor_name, visitor_id, purpose, host, host_office, 
         expiry_hours, expires_at, issued_by, qr_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        badge.id,
        badge.visitorName,
        badge.visitorId || null,
        badge.purpose,
        badge.host,
        badge.hostOffice,
        badge.expiryHours,
        new Date(Date.now() + badge.expiryHours * 60 * 60 * 1000),
        badge.issuedBy,
        `Visitor:${badge.visitorName}|ID:${badge.id}|Host:${badge.host}`
      ];

      await dbPool.query(sql, values);

      // Broadcast notification
      io.emit(`notification-${targetRole}`, {
        type: 'visitor_arrival',
        title: 'New Visitor Alert',
        message: message,
        badgeId: badge.id,
        visitorName: badge.visitorName,
        host: badge.host,
        hostOffice: badge.hostOffice,
        timestamp: timestamp,
        badge: badge
      });

      // Also notify Directors
      io.emit('notification-director', {
        type: 'visitor_arrival',
        title: 'Visitor Badge Generated',
        message: `New visitor for ${badge.hostOffice}`
      });

    } catch (err) {
      console.error('Error saving visitor badge:', err);
    }
  });

});

// Start Server
const PORT = process.env.PORT || 5001;

(async () => {
  try {
    // Test DB Connection
    await dbPool.query('SELECT 1');
    console.log('✅ Database connected successfully with utf8mb4');
    
    app.set('dbPool', dbPool);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
})();