// route/chequeRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');   // Make sure this path is correct

// GET Pending Cheques
router.get('/pending', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM cheques 
      WHERE status = 'pending' 
      ORDER BY recordedAt DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending cheques:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Submitted Cheques
router.get('/submitted', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM cheques 
      WHERE status = 'submitted' 
      ORDER BY submittedAt DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching submitted cheques:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Record New Cheque
router.post('/record', async (req, res) => {
  try {
    const {
      chequeNumber, accountNumber, amount, date, whoSubmitted,
      receptionistName, siteId, photoPreview
    } = req.body;

    const id = Date.now();

    const sql = `
      INSERT INTO cheques 
        (id, chequeNumber, accountNumber, amount, date, whoSubmitted, 
         receptionistName, siteId, photoPreview, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const values = [
      id, chequeNumber, accountNumber, amount, date,
      whoSubmitted, receptionistName, siteId, photoPreview || null
    ];

    await db.query(sql, values);

    res.status(201).json({ 
      success: true, 
      cheque: { 
        id, 
        ...req.body, 
        status: 'pending', 
        recordedAt: new Date().toLocaleString() 
      } 
    });
  } catch (err) {
    console.error('Error recording cheque:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Submit Cheques
router.post('/submit', async (req, res) => {
  try {
    const { chequeIds, submittedBy } = req.body;

    if (!chequeIds || !Array.isArray(chequeIds) || chequeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid chequeIds' });
    }

    const [result] = await db.query(`
      UPDATE cheques 
      SET status = 'submitted', 
          submittedAt = NOW(), 
          submittedBy = ? 
      WHERE id IN (?) AND status = 'pending'
    `, [submittedBy, chequeIds]);

    res.json({ 
      success: true, 
      submittedCount: result.affectedRows 
    });
  } catch (err) {
    console.error('Error submitting cheques:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT Review / Approve Cheque
router.put('/review/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    let sql = '';
    if (role?.toLowerCase() === 'director') {
      sql = "UPDATE cheques SET receivedByDirector = TRUE WHERE id = ?";
    } else if (role?.toLowerCase() === 'accountant') {
      sql = "UPDATE cheques SET receivedByAccountant = TRUE WHERE id = ?";
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const [result] = await db.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error reviewing cheque:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;