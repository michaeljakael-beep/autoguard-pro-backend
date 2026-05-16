// routes/shiftRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Shift = require('../models/ShiftModel'); 

// Get all shifts
router.get('/', authenticate, async (req, res) => {
  try {
    const shifts = await Shift.getAll();
    res.json(shifts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch shifts' });
  }
});

// Create shift
router.post('/', authenticate, async (req, res) => {
  try {
    const shiftData = { ...req.body, created_by: req.user?.id };
    const newShift = await Shift.create(shiftData);
    res.status(201).json(newShift);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign guard
router.post('/assign-shift', authenticate, async (req, res) => {
  try {
    const { shift_id, user_id } = req.body;
    await Shift.assignGuard(shift_id, user_id, req.user?.id);
    res.json({ message: 'Guard assigned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to assign guard' });
  }
});

// ====================== ACTIVE GUARDS ======================
router.get('/active-guards', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    const [activeGuards] = await db.query(`
    SELECT 
      sa.user_id as id,
      CONCAT(u.first_name, ' ', u.surname) AS full_name,
      u.staff_id,
      s.shift_type,
      s.site_id,
      sites.site_name as post,
      sa.assigned_at as lastReport,
      'On Duty' as status
    FROM shift_assignments sa
    JOIN users u ON sa.user_id = u.staff_id
    JOIN shifts s ON sa.shift_id = s.shift_id
    LEFT JOIN sites ON s.site_id = sites.id
    WHERE s.shift_date = CURDATE()
      AND s.status IN ('Ongoing', 'Active', 'Assigned')
    ORDER BY sa.assigned_at DESC
    LIMIT 10
    `);

    res.json(activeGuards || []);

  } catch (error) {
    console.error('❌ Active Guards Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch active guards' 
    });
  }
});

// ====================== CLOCK IN / OUT ======================
router.post('/clock', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, clock_type } = req.body;
    const staff_id = req.user?.staff_id || req.user?.id;
    const db = req.app.get('dbPool');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (!staff_id || !clock_type) {
      return res.status(400).json({
        success: false,
        message: "Staff ID and clock_type are required"
      });
    }

    const clockTypeUpper = clock_type.toUpperCase();

    // Check if record exists for today
    const [existing] = await db.query(
      `SELECT * FROM attendance WHERE staff_id = ? AND date = ?`,
      [staff_id, today]
    );

    if (existing.length > 0) {
      // Update existing record
      if (clockTypeUpper === 'IN' && !existing[0].check_in) {
        await db.query(
          `UPDATE attendance 
           SET check_in = CURRENT_TIME(), 
               status = 'present', 
               notes = CONCAT(COALESCE(notes, ''), ' | Clocked IN at ', NOW()) 
           WHERE staff_id = ? AND date = ?`,
          [staff_id, today]
        );
      } else if (clockTypeUpper === 'OUT' && !existing[0].check_out) {
        await db.query(
          `UPDATE attendance 
           SET check_out = CURRENT_TIME(), 
               notes = CONCAT(COALESCE(notes, ''), ' | Clocked OUT at ', NOW()) 
           WHERE staff_id = ? AND date = ?`,
          [staff_id, today]
        );
      } else {
        return res.status(400).json({
          success: false,
          message: `Already clocked ${clockTypeUpper} today`
        });
      }
    } else {
      // Create new record
      await db.query(
        `INSERT INTO attendance 
         (staff_id, date, status, check_in, check_out, notes) 
         VALUES (?, ?, 'present', 
           IF(?, CURRENT_TIME(), NULL), 
           IF(?, CURRENT_TIME(), NULL), 
           CONCAT('Clocked ', ?, ' at ', NOW()))`,
        [
          staff_id, 
          today, 
          clockTypeUpper === 'IN', 
          clockTypeUpper === 'OUT',
          clockTypeUpper
        ]
      );
    }

    console.log(`✅ Staff ${staff_id} clocked ${clockTypeUpper}`);

    res.json({
      success: true,
      message: `Successfully clocked ${clockTypeUpper}`,
      data: {
        staff_id,
        clock_type: clockTypeUpper,
        date: today,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Clock Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to process clocking"
    });
  }
});
module.exports = router;