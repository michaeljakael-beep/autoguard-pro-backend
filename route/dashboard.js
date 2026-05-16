// routes/dashboard.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');

// ====================== TEST ROUTE ======================
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Dashboard routes working!' });
});

// ==================== GUARD DASHBOARD ROUTES ====================

// GET Guard Stats + Shift + Attendance
router.get('/clock', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const staffId = req.user.staff_id || req.user.id;

    // Fetch today's shift
    const [shiftResult] = await db.query(`
      SELECT 
        s.shift_type as shiftType,
        s.start_time,
        s.end_time,
        s.status as shiftStatus,
        sites.site_name as site
      FROM shifts s
      LEFT JOIN sites ON s.site_id = sites.id
      WHERE s.created_by = ? 
        AND s.shift_date = CURDATE()
      ORDER BY s.shift_id DESC 
      LIMIT 1
    `, [staffId]);

    // Fetch today's attendance
    const [attendanceResult] = await db.query(`
      SELECT status, check_in, check_out 
      FROM attendance 
      WHERE staff_id = ? AND date = CURDATE()
      LIMIT 1
    `, [staffId]);

    const shiftData = shiftResult[0] || null;
    const att = attendanceResult[0] || null;

    const attendance = {
      status: att ? (att.check_out ? 'clocked_out' : 'clocked_in') : 'off_duty',
      clockInTime: att?.check_in ? att.check_in.slice(0, 5) : null
    };

    let shiftTime = "18:00 - 06:00";
    if (shiftData?.start_time && shiftData?.end_time) {
      shiftTime = `${shiftData.start_time.slice(0,5)} - ${shiftData.end_time.slice(0,5)}`;
    }

    res.json({
      success: true,
      data: {
        shift: {
          shiftType: shiftData?.shiftType || "Night Shift",
          time: shiftTime,
          site: shiftData?.site || "Westgate Mall",
          gate: "Gate A"
        },
        attendance
      }
    });

  } catch (error) {
    console.error('❌ Guard Clock Data Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch guard data' 
    });
  }
});

// POST Clock In / Clock Out
router.post('/guard/clock', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const staffId = req.user.staff_id || req.user.id;
    const { action } = req.body;

    if (!['clock_in', 'clock_out'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const today = new Date().toISOString().split('T')[0];

    if (action === 'clock_in') {
      const [existing] = await db.query(
        'SELECT * FROM attendance WHERE staff_id = ? AND date = ?', 
        [staffId, today]
      );

      if (existing.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'You already clocked in today' 
        });
      }

      await db.query(`
        INSERT INTO attendance (staff_id, date, status, check_in, notes)
        VALUES (?, ?, 'present', CURTIME(), 'Clocked in via dashboard')
      `, [staffId, today]);

    } else { // clock_out
      const [record] = await db.query(`
        SELECT * FROM attendance 
        WHERE staff_id = ? AND date = ? 
        LIMIT 1
      `, [staffId, today]);

      if (record.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please clock in first' 
        });
      }

      if (record[0].check_out) {
        return res.status(400).json({ 
          success: false, 
          message: 'You have already clocked out' 
        });
      }

      await db.query(`
        UPDATE attendance 
        SET check_out = CURTIME(), 
            notes = CONCAT(IFNULL(notes, ''), ' | Clocked out via dashboard')
        WHERE staff_id = ? AND date = ?
      `, [staffId, today]);
    }

    res.json({
      success: true,
      message: `Successfully ${action.replace('_', ' ')}ed!`
    });

  } catch (error) {
    console.error('❌ Clock Action Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process clock action' });
  }
});
// ====================== SUPERVISOR DASHBOARD ======================
router.get('/supervisor', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const today = new Date().toISOString().split('T')[0];

    // 1. Guards on Duty (Best approach using shift_assignments + shifts)
    const [guardsOnDuty] = await db.query(`
      SELECT COUNT(DISTINCT sa.user_id) as count
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.shift_id
      WHERE s.shift_date = CURDATE()
        AND s.status IN ('Ongoing', 'Active', 'Assigned')
    `);

    // Alternative fallback if no assignments yet
    const [totalStaffOnDuty] = await db.query(`
      SELECT COUNT(*) as count 
      FROM shifts 
      WHERE status = 'On Duty'
    `);

    // 2. Active Patrols
    const [activePatrols] = await db.query(`
      SELECT COUNT(*) as count 
      FROM patrol_reports 
      WHERE status = 'Active' 
        AND DATE(created_at) = CURDATE()
    `);

    // 3. Pending Incidents
    const [pendingIncidents] = await db.query(`
      SELECT COUNT(*) as count 
      FROM incidents 
      WHERE status IN ('Open', 'Pending', 'In Progress', 'New')
    `);

    // 4. Shifts Completed Today
    const [completedShifts] = await db.query(`
      SELECT COUNT(*) as count 
      FROM shifts 
      WHERE shift_date = ? 
        AND status = 'Completed'
    `, [today]);

    const finalGuardsOnDuty = parseInt(guardsOnDuty[0].count) || parseInt(totalStaffOnDuty[0].count) || 0;

    res.json({
      success: true,
      guardsOnDuty: finalGuardsOnDuty,
      activePatrols: parseInt(activePatrols[0].count) || 0,
      pendingIncidents: parseInt(pendingIncidents[0].count) || 0,
      completedShifts: parseInt(completedShifts[0].count) || 0,
    });

  } catch (error) {
    console.error('❌ Supervisor Dashboard Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard statistics',
      error: error.message 
    });
  }
});
// ====================== MANAGER DASHBOARD ROUTES ======================

// GET Manager Statistics
router.get('/manager-stats', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    // Active Guards
    const [activeGuardsRes] = await db.query(`
      SELECT COUNT(DISTINCT sa.user_id) as activeGuards 
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.shift_id
      WHERE s.shift_date = CURDATE() 
        AND s.status IN ('Ongoing', 'Active', 'Assigned')
    `);

    // Total Sites
    const [sitesRes] = await db.query(`SELECT COUNT(*) as totalSites FROM sites`);

    // Incidents Today
    const [incidentsRes] = await db.query(`
      SELECT COUNT(*) as incidentsToday 
      FROM incidents 
      WHERE DATE(created_at) = CURDATE()
    `);

    // Patrol Completion Rate - Using status as fallback (you can improve later)
    const [patrolRes] = await db.query(`
      SELECT ROUND(AVG(CASE WHEN status = 'Completed' THEN 100 ELSE 60 END), 0) as completionRate 
      FROM patrol_reports 
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `);

    // Revenue This Month (if payments table exists, otherwise 0)
    const [revenueRes] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as revenue 
      FROM payments 
      WHERE MONTH(payment_date) = MONTH(CURDATE()) 
        AND YEAR(payment_date) = YEAR(CURDATE())
    `);

    // Pending Approvals
    const [approvalsRes] = await db.query(`
      SELECT COUNT(*) as pendingApprovals 
      FROM advances 
      WHERE status = 'Pending'
    `);

    res.json({
      activeGuards: parseInt(activeGuardsRes[0]?.activeGuards) || 0,
      totalSites: parseInt(sitesRes[0]?.totalSites) || 0,
      incidentsToday: parseInt(incidentsRes[0]?.incidentsToday) || 0,
      completionRate: parseInt(patrolRes[0]?.completionRate) || 85,
      revenue: parseInt(revenueRes[0]?.revenue) || 0,
      pendingApprovals: parseInt(approvalsRes[0]?.pendingApprovals) || 0
    });

  } catch (error) {
    console.error('❌ Manager Stats Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch manager statistics' 
    });
  }
});

// GET Recent Incidents - Fixed for your incidents table
router.get('/incidents/recent', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    const [incidents] = await db.query(`
      SELECT 
        id,
        location as site,
        incident_type as type,
        severity,
        DATE_FORMAT(created_at, '%H:%i') as time,
        status
      FROM incidents 
      WHERE DATE(created_at) = CURDATE()
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    res.json(incidents);
  } catch (error) {
    console.error('❌ Recent Incidents Error:', error);
    res.status(500).json([]);
  }
});
// GET Top Performers - Updated to match users table schema
router.get('/performance/top-performers', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    const [performers] = await db.query(`
      SELECT 
        CONCAT(u.first_name, ' ', u.surname) as name,
        u.role_id as role,                -- Updated from u.role to u.role_id
        85 as score,                      -- Placeholder until you add scoring
        'Site Location' as site           -- Update when you link sites
      FROM patrol_reports pr
      JOIN users u ON pr.user_id = u.staff_id -- Updated join from u.id to u.staff_id
      WHERE DATE(pr.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY u.staff_id
      ORDER BY MAX(pr.created_at) DESC 
      LIMIT 3
    `);

    res.json(performers);
  } catch (error) {
    console.error('❌ Top Performers Error:', error);
    res.status(500).json([]);
  }
});

// GET Active Patrols - Fixed for your patrol_reports table
router.get('/patrols/active', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    const [patrols] = await db.query(`
      SELECT 
        CONCAT('Team ', (pr.id % 5) + 1) as team,
        'Assigned Site' as site,
        CASE 
          WHEN pr.status = 'Completed' THEN 100 
          WHEN pr.status = 'Active' THEN 75 
          ELSE 50 
        END as progress
      FROM patrol_reports pr
      WHERE pr.status = 'Active'
        AND DATE(pr.created_at) = CURDATE()
      ORDER BY pr.created_at DESC 
      LIMIT 5
    `);

    res.json(patrols);
  } catch (error) {
    console.error('❌ Active Patrols Error:', error);
    res.status(500).json([]);
  }
});

module.exports = router;