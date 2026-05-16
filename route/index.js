// route/index.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');

// Import Routes
const authRoutes = require('./auth');
const advancesRoutes = require('./advance');
const chequeRoutes = require('./chequeRoutes');
const hrRoutes = require('./hr');
const incidentRoutes = require('./incidentRoutes');
const profileRoutes = require('./profile');
const settingsRoutes = require('./settings');
const usersRoutes = require('./users');
const clientsRoutes = require('./clients');
const reportRoutes = require('./reportRoutes');
const shiftRoutes = require('./shiftRoutes');
const visitorBadgeRoutes = require('./visitorBadgeRoute');
const obRoutes = require('./obRoute');
const sitesRoutes = require('./siteRoutes');
const dashboardRoutes = require('./dashboard'); 
const patrolRoutes = require('./patrolRoute');
const geolocationRoutes = require('./geolocationRoutes');
const SignupRoutes = require('./Signup'); // ← New Signup route with file uploads
const visitorsRoutes = require('./visitorsRoutes');
attendanceRoutes = require('./attendanceRoutes');

// ====================== LOGGING MIDDLEWARE ======================

// Debug logs
console.log("🔍 authRoutes type:", typeof authRoutes);
console.log("🔍 dashboardRoutes type:", typeof dashboardRoutes);
console.log("🔍 incidentRoutes type:", typeof incidentRoutes);
console.log("🔍 geolocationRoutes type:", typeof geolocationRoutes);
console.log("🔍 SignupRoutes type:", typeof SignupRoutes);
// ====================== MOUNT ROUTES ======================
router.use('/auth', authRoutes);
router.use('/advances', authenticate, advancesRoutes);
router.use('/cheques', authenticate, chequeRoutes);
router.use('/hr', authenticate, hrRoutes);
router.use('/incidents', authenticate, incidentRoutes);
router.use('/profile', authenticate, profileRoutes);
router.use('/settings', authenticate, settingsRoutes);
router.use('/users', authenticate, usersRoutes);           // ← Added authenticate
router.use('/clients', authenticate, clientsRoutes);
router.use('/reports', authenticate, reportRoutes);
router.use('/shifts', authenticate, shiftRoutes);
router.use('/ob', authenticate, obRoutes);
router.use('/sites', authenticate, sitesRoutes);
router.use('/visitor-badges', authenticate, visitorBadgeRoutes);
router.use('/patrols', authenticate, patrolRoutes);  // ← Mounted patrol routes with authentication
router.use('/geolocation', authenticate, geolocationRoutes); // ← Mounted geolocation routes with authentication
router.use('/signup', SignupRoutes); // ← Mounted signup routes (no authentication needed)
router.use('/visitors', authenticate, visitorsRoutes); // ← Mounted visitors routes with authentication
router.use('/attendance', authenticate, attendanceRoutes); // ← Mounted attendance routes with authentication

// Dashboard Route (Only once!)
router.use('/dashboard', authenticate, dashboardRoutes);

console.log("✅ All routes mounted successfully");

module.exports = router;