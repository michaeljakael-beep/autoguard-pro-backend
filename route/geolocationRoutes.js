// routes/geolocationRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// ====================== GEOLOCATION ROUTES ======================

// Get All Users' Live Locations (For Admin & Director)
router.get('/all', authenticate, async (req, res) => {
    try {
        const db = req.app.get('dbPool');

        const query = `
            SELECT 
                u.staff_id,
                u.first_name,
                u.surname,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, '')) as name,
                u.role_id,
                gl.latitude,
                gl.longitude,
                gl.accuracy,
                gl.speed,
                gl.battery_level,
                gl.last_updated,
                TIMESTAMPDIFF(MINUTE, gl.last_updated, NOW()) as minutes_ago
            FROM users u
            LEFT JOIN guard_locations gl 
                ON u.staff_id = gl.staff_id
            WHERE gl.latitude IS NOT NULL 
              AND gl.longitude IS NOT NULL
            ORDER BY gl.last_updated DESC, u.first_name ASC;
        `;

        const [users] = await db.query(query);

        res.json({
            success: true,
            count: users.length,
            users: users.map(user => ({
                staff_id: user.staff_id,
                first_name: user.first_name,
                surname: user.surname,
                name: user.name,
                role_id: user.role_id,
                // Optional: You can map role_id to role name later if needed
                role: user.role_id ? `Role ${user.role_id}` : 'Unknown',
                latitude: user.latitude,
                longitude: user.longitude,
                accuracy: user.accuracy,
                speed: user.speed,
                battery_level: user.battery_level,
                last_updated: user.last_updated,
                lastUpdated: user.last_updated 
                    ? new Date(user.last_updated).toLocaleString() 
                    : null,
                isLive: user.minutes_ago !== null && user.minutes_ago <= 30
            }))
        });

    } catch (error) {
        console.error('Geolocation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch locations',
            details: error.message
        });
    }
});

// Update Current User's Location
router.post('/update', authenticate, async (req, res) => {
    const { latitude, longitude, accuracy, speed, battery_level } = req.body;
    const staff_id = req.user?.staff_id;

    if (!staff_id || !latitude || !longitude) {
        return res.status(400).json({ 
            success: false, 
            error: 'staff_id, latitude and longitude are required' 
        });
    }

    try {
        const db = req.app.get('dbPool');

        const query = `
            INSERT INTO guard_locations 
                (staff_id, latitude, longitude, accuracy, speed, battery_level, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                latitude = VALUES(latitude),
                longitude = VALUES(longitude),
                accuracy = VALUES(accuracy),
                speed = VALUES(speed),
                battery_level = VALUES(battery_level),
                last_updated = NOW();
        `;

        await db.query(query, [
            staff_id, 
            parseFloat(latitude), 
            parseFloat(longitude), 
            accuracy ? parseFloat(accuracy) : null,
            speed ? parseFloat(speed) : null,
            battery_level ? parseInt(battery_level) : null
        ]);

        res.json({ 
            success: true, 
            message: 'Location updated successfully' 
        });

    } catch (error) {
        console.error('Update Location Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update location',
            details: error.message 
        });
    }
});

module.exports = router;