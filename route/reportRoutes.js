const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

// ====================== SUMMARY / OVERVIEW ======================
router.get('/summary', async (req, res) => {
    try {
        const queries = [
            // Total Active Staff
            db.query("SELECT COUNT(*) as totalStaff FROM users WHERE is_active = 1"),
            
            // Today's Attendance
            db.query(`
                SELECT COUNT(*) as todayAttendance 
                FROM attendance 
                WHERE date = CURDATE() AND status = 'present'
            `),
            
            // Pending Advances
            db.query("SELECT COUNT(*) as pendingAdvances FROM advances WHERE status = 'pending'"),
            
            // Open Incidents
            db.query("SELECT COUNT(*) as openIncidents FROM incidents WHERE status IN ('open', 'pending')"),
            
            // Patrols Today
            db.query(`
                SELECT COUNT(*) as patrolsToday 
                FROM patrol_reports 
                WHERE DATE(created_at) = CURDATE()
            `),
            
            // Visitors Today
            db.query(`
                SELECT COUNT(*) as visitorsToday 
                FROM visitor_logs 
                WHERE DATE(check_in) = CURDATE()
            `),
            
            // Open Support Tickets
            db.query(`
                SELECT COUNT(*) as openTickets 
                FROM support_tickets 
                WHERE status IN ('pending', 'in_progress')
            `)
        ];

        const results = await Promise.all(queries);

        const summary = {
            totalStaff: parseInt(results[0][0][0].totalStaff) || 0,
            todayAttendance: parseInt(results[1][0][0].todayAttendance) || 0,
            pendingAdvances: parseInt(results[2][0][0].pendingAdvances) || 0,
            openIncidents: parseInt(results[3][0][0].openIncidents) || 0,
            patrolsToday: parseInt(results[4][0][0].patrolsToday) || 0,
            visitorsToday: parseInt(results[5][0][0].visitorsToday) || 0,
            openTickets: parseInt(results[6][0][0].openTickets) || 0,
        };

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Summary Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard summary',
            error: error.message
        });
    }
});

// ====================== GET ALL REPORTS ======================
router.get('/all', async (req, res) => {
    try {
        const query = `
            SELECT 
                obr.id,
                'OB Report' as reportType,
                LEFT(obr.description, 50) as title,
                DATE(obr.created_at) as date,
                obr.created_at,
                obr.site_id as site_name, 
                CONCAT(u1.first_name, ' ', u1.surname) as generatedBy,
                obr.status
            FROM ob_reports obr
            LEFT JOIN users u1 ON obr.staff_id = u1.staff_id

            UNION ALL

            SELECT 
                pr.id,
                'Patrol Report' as reportType,
                IFNULL(pr.notes, 'Patrol Entry') as title,
                DATE(pr.created_at) as date,
                pr.created_at,
                'N/A' as site_name,
                CONCAT(u2.first_name, ' ', u2.surname) as generatedBy,
                pr.status
            FROM patrol_reports pr
            LEFT JOIN users u2 ON pr.user_id = u2.staff_id

            UNION ALL

            SELECT 
                inc.id,
                'Incident Report' as reportType,
                inc.title as title,
                DATE(inc.incident_date) as date,
                inc.created_at,
                inc.location as site_name, 
                CONCAT(u3.first_name, ' ', u3.surname) as generatedBy,
                inc.status
            FROM incidents inc
            LEFT JOIN users u3 ON inc.staff_id = u3.staff_id

            UNION ALL

            SELECT 
                staffID as id,
                'Staff Advance' as reportType,
                CONCAT('Advance - ', adv.amount) as title,
                 applicationDate as date,
                approvedBy,
                NULL as site_name,
                submittedBy as generatedBy,
                adv.status
            FROM advances adv

            ORDER BY created_at DESC
            LIMIT 500
        `; // <--- Make sure this closing backtick and semicolon are here!

        const [reports] = await db.query(query);

        res.json({
            success: true,
            count: reports.length,
            reports: reports
        });

    } catch (error) {
        console.error('Error fetching all reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reports',
            details: error.message
        });
    }
});
// ====================== PARAMETERIZED REPORTS ======================
router.get('/:reportType', async (req, res) => {
    const { reportType } = req.params;
    const { 
        startDate, 
        endDate, 
        status, 
        reportedBy, 
        incidentType, 
        search 
    } = req.query;

    try {
        let query = '';
        let params = [];

        if (reportType === 'incidents') {
            query = 'CALL sp_report_incidents(?, ?, ?, ?, ?, ?)';
            params = [
                startDate || null,
                endDate || null,
                status || null,
                reportedBy ? parseInt(reportedBy) : null,
                incidentType || null,
                search || null
            ];
        } 
        else if (reportType === 'advances') {
            query = 'CALL sp_report_advances(?, ?, ?, ?)';
            params = [
                startDate || null,
                endDate || null,
                status || null,
                search || null
            ];
        } 
        else if (reportType === 'ob') { 
            query = `
                SELECT * FROM ob_reports 
                WHERE (? IS NULL OR DATE(created_at) >= ?) 
                  AND (? IS NULL OR DATE(created_at) <= ?)
                ORDER BY created_at DESC
            `;
            params = [startDate || null, startDate || null, endDate || null, endDate || null];
        }
        else if (reportType === 'patrol') {
            query = `
                SELECT * FROM patrol_reports 
                WHERE (? IS NULL OR DATE(created_at) >= ?) 
                  AND (? IS NULL OR DATE(created_at) <= ?)
                ORDER BY created_at DESC
            `;
            params = [startDate || null, startDate || null, endDate || null, endDate || null];
        }
        else {
            return res.status(400).json({ 
                error: 'Invalid report type. Use: incidents, advances, ob, patrol, or /all' 
            });
        }

        const [results] = await db.query(query, params);
        
        res.json({
            success: true,
            reportType,
            data: results[0] || results
        });

    } catch (error) {
        console.error('Report Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to generate report', 
            details: error.message 
        });
    }
});

router.get('/:reportType/:id', async (req, res) => {
    res.json({ message: "Single report endpoint - extend as needed" });
});

module.exports = router;