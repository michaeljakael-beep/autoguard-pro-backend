// routes/guard.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // your JWT middleware
const GuardAttendance = require('../models/GuardAttendance');
const Shift = require('../models/Shift'); // if you have one

// === GET Guard Stats ===
router.get('/dashboard/guard-stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // from JWT

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await GuardAttendance.findOne({
      guard: userId,
      date: { $gte: today }
    }).sort({ createdAt: -1 });

    // Get current/active shift (customize as needed)
    const shift = await Shift.findOne({ 
      guard: userId,
      status: 'active'
    }) || {};

    res.json({
      success: true,
      data: {
        attendance: attendance || { status: 'off_duty' },
        shift: {
          shiftType: shift.shiftType || null,
          time: shift.time || null,
          site: shift.site || "Westgate Mall",
          gate: shift.gate || "Gate A",
          location: shift.location
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// === CLOCK IN / OUT ===
router.post('/guard/clock', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body; // 'clock_in' or 'clock_out'
    const userId = req.user.id;

    if (!['clock_in', 'clock_out'].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await GuardAttendance.findOne({
      guard: userId,
      date: { $gte: today }
    });

    if (action === 'clock_in') {
      if (attendance && attendance.status === 'clocked_in') {
        return res.status(400).json({ success: false, message: "Already clocked in" });
      }

      if (!attendance) {
        attendance = new GuardAttendance({
          guard: userId,
          date: today,
          status: 'clocked_in',
          clockInTime: new Date(),
        });
      } else {
        attendance.status = 'clocked_in';
        attendance.clockInTime = new Date();
      }
    } 
    else { // clock_out
      if (!attendance || attendance.status !== 'clocked_in') {
        return res.status(400).json({ success: false, message: "Not clocked in" });
      }

      attendance.status = 'clocked_out';
      attendance.clockOutTime = new Date();
      
      // Calculate duration (optional)
      if (attendance.clockInTime) {
        attendance.duration = (attendance.clockOutTime - attendance.clockInTime) / (1000 * 60); // minutes
      }
    }

    await attendance.save();

    res.json({
      success: true,
      message: action === 'clock_in' ? "Clocked in successfully" : "Clocked out successfully",
      data: attendance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;