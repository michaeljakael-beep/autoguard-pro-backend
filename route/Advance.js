// routes/advances.js - IMPROVED & CLEANED VERSION
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// In-memory advance window state
let advanceWindow = {
  isOpen: false,
  initiatedAt: null,
  initiatedBy: null,
  month: null,
  year: null,
  monthName: null
};

// ==================== GET ALL ADVANCES ====================
router.get('/', authenticate, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const { month, year } = req.query;

    let query = 'SELECT * FROM advances';
    const params = [];

    if (month && year) {
      query += ' WHERE advance_month = ? AND advance_year = ?';
      params.push(parseInt(month), parseInt(year));
    }

    query += ' ORDER BY submittedAt DESC';

    const [advances] = await dbPool.query(query, params);

    res.json(advances);
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch advances' });
  }
});

// ==================== CHECK IF USER HAS APPLIED ====================
router.get('/user/:staff_id', authenticate, async (req, res) => {
  try {
    const { staff_id } = req.params;
    const dbPool = req.app.get('dbPool');

    const [result] = await dbPool.query(
      `SELECT COUNT(*) as count FROM advances 
       WHERE staff_id = ? AND status != 'rejected'`,
      [staff_id]
    );

    res.json({
      success: true,
      hasApplied: result[0].count > 0
    });
  } catch (error) {
    console.error('Error checking user application:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== INITIATE ADVANCE WINDOW (New) ====================
router.post('/initiate-window', authenticate, async (req, res) => {
  try {
    const { month, year, initiatedBy } = req.body;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and Year are required'
      });
    }

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

    advanceWindow = {
      isOpen: true,
      initiatedAt: new Date(),
      initiatedBy: initiatedBy || 'HR',
      month: parseInt(month),
      year: parseInt(year),
      monthName
    };

    const io = req.app.get('io');
    io.emit('advance-window-initiated', {
      initiationDate: advanceWindow.initiatedAt.toISOString(),
      month: advanceWindow.month,
      year: advanceWindow.year,
      monthName: advanceWindow.monthName,
      initiatedBy: advanceWindow.initiatedBy
    });

    res.json({
      success: true,
      message: `Advance window initiated for ${monthName} ${year}`,
      data: advanceWindow
    });

  } catch (error) {
    console.error('Error initiating window:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate window' });
  }
});

// ==================== SUBMIT ADVANCE ====================
router.post('/', authenticate, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const {
      staff_id,
      staffID,
      phone,
      amount,
      siteID = 'SITE-001',
      submittedBy,
      advance_month,
      advance_year
    } = req.body;

    if (!staff_id || !amount || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Staff ID, amount and phone are required' 
      });
    }

    if (!advanceWindow.isOpen) {
      return res.status(403).json({
        success: false,
        message: 'Advance window is currently closed. Please wait for HR to open it.'
      });
    }

    await dbPool.query(`
      INSERT INTO advances (
        staff_id, staffID, phone, amount, siteID, submittedBy, 
        advance_month, advance_year, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      ON DUPLICATE KEY UPDATE 
        amount = VALUES(amount), 
        phone = VALUES(phone), 
        siteID = VALUES(siteID),
        submittedBy = VALUES(submittedBy), 
        advance_month = VALUES(advance_month),
        advance_year = VALUES(advance_year),
        status = 'pending', 
        submittedAt = CURRENT_TIMESTAMP
    `, [
      staff_id, 
      staffID || staff_id, 
      phone, 
      amount, 
      siteID, 
      submittedBy,
      advance_month || advanceWindow.month,
      advance_year || advanceWindow.year
    ]);

    const newAdvance = {
      staff_id,
      staffID: staffID || staff_id,
      phone,
      amount,
      siteID,
      advance_month: advance_month || advanceWindow.month,
      advance_year: advance_year || advanceWindow.year,
      status: 'pending',
      submittedAt: new Date(),
      submittedBy
    };

    req.app.get('io').emit('new-advance-application', newAdvance);

    res.json({
      success: true,
      message: 'Advance request submitted successfully',
      data: newAdvance
    });

  } catch (error) {
    console.error('Error submitting advance:', error);
    res.status(500).json({ success: false, message: 'Failed to submit advance request' });
  }
});

// ==================== APPROVE ADVANCE ====================
router.put('/:staff_id/approve', authenticate, async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { approvedBy, signature } = req.body;
    const dbPool = req.app.get('dbPool');

    await dbPool.query(`
      UPDATE advances 
      SET status = 'approved', 
          approvedBy = ?, 
          approvedAt = NOW(), 
          signature = ?
      WHERE staff_id = ?
    `, [approvedBy, signature, staff_id]);

    req.app.get('io').emit('advance-approved');
    res.json({ success: true, message: 'Advance approved successfully' });
  } catch (error) {
    console.error('Error approving advance:', error);
    res.status(500).json({ success: false, message: 'Failed to approve advance' });
  }
});

// ==================== REJECT ADVANCE ====================
router.put('/:staff_id/reject', authenticate, async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { rejectedBy, reason } = req.body;
    const dbPool = req.app.get('dbPool');

    await dbPool.query(`
      UPDATE advances 
      SET status = 'rejected', 
          rejectedBy = ?, 
          rejectionReason = ?, 
          rejectedAt = NOW()
      WHERE staff_id = ?
    `, [rejectedBy, reason, staff_id]);

    res.json({ success: true, message: 'Advance rejected successfully' });
  } catch (error) {
    console.error('Error rejecting advance:', error);
    res.status(500).json({ success: false, message: 'Failed to reject advance' });
  }
});

// ==================== CLOSE WINDOW ====================
router.post('/close-window', authenticate, async (req, res) => {
  try {
    advanceWindow.isOpen = false;
    advanceWindow.initiatedAt = null;
    advanceWindow.initiatedBy = null;
    advanceWindow.month = null;
    advanceWindow.year = null;
    advanceWindow.monthName = null;

    req.app.get('io').emit('advance-window-closed');
    
    res.json({ 
      success: true, 
      message: 'Advance window closed successfully' 
    });
  } catch (error) {
    console.error('Error closing window:', error);
    res.status(500).json({ success: false, message: 'Failed to close window' });
  }
});

// Get current window status (Optional but useful)
router.get('/window-status', (req, res) => {
  res.json({
    success: true,
    window: advanceWindow
  });
});

module.exports = router;