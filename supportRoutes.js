// routes/supportRoutes.js

const express = require('express');
const router = express.Router();

// ====================== CREATE NEW SUPPORT TICKET ======================
router.post('/tickets', async (req, res) => {
  const { subject, message, priority = 'medium' } = req.body;
  const user_id = req.user?.user_id;

  if (!user_id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }

  try {
    const [result] = await req.dbPool.query(`
      INSERT INTO support_tickets (user_id, subject, message, priority, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', NOW())
    `, [user_id, subject.trim(), message.trim(), priority.toLowerCase()]);

    res.status(201).json({
      success: true,
      message: 'Ticket submitted successfully',
      ticket_id: result.insertId
    });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// ====================== GET MY TICKETS ======================
router.get('/tickets/my', async (req, res) => {
  const user_id = req.user?.user_id;

  if (!user_id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [tickets] = await req.dbPool.query(`
      SELECT id, subject, priority, status, created_at 
      FROM support_tickets 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [user_id]);

    res.json({ tickets });
  } catch (err) {
    console.error('Fetch my tickets error:', err);
    res.status(500).json({ error: 'Failed to load your tickets' });
  }
});

// ====================== GET ALL TICKETS (Admin & Director Only) ======================
router.get('/tickets/all', async (req, res) => {
  const role = req.user?.role?.toLowerCase?.() || '';

  if (!['director', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Access denied. Only Director and Admin can view all tickets.' });
  }

  try {
    const [tickets] = await req.dbPool.query(`
      SELECT 
        st.id,
        st.subject,
        st.message,
        st.priority,
        st.status,
        st.created_at,
        CONCAT(u.first_name, ' ', COALESCE(u.surname, '')) AS userName
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.user_id
      ORDER BY st.created_at DESC
    `);

    res.json({ tickets });
  } catch (err) {
    console.error('Fetch all tickets error:', err);
    res.status(500).json({ error: 'Failed to load all tickets' });
  }
});

module.exports = router;