// backend/controllers/dashboardController.js
const db = require('../config/db');
const { rolePermissions } = require('../utils/rolePermissions');

const getDashboardData = async (req, res) => {
  try {
    const roleId = parseInt(req.user.role_id);
    const userId = req.user.user_id || req.user.staff_id;
    const siteId = req.user.site_id;

    const dashboardData = {
      user: {
        name: `${req.user.first_name} ${req.user.surname}`,
        role_id: roleId,
        role_name: req.user.role
      },
      kpis: {},
      charts: {},
      recentActivities: [],
      roleSpecific: {}
    };

    // ==================== COMMON QUERIES ====================
    const [totalGuards] = await db.execute(
      "SELECT COUNT(*) as count FROM users WHERE role_id IN (5, 65)"
    );

    const [activeShifts] = await db.execute(
      `SELECT COUNT(*) as count FROM shifts 
       WHERE DATE(shift_date) = CURDATE() AND status = 'active'`
    );

    // ==================== ROLE-BASED DATA ====================

    switch (roleId) {
      // ==================== DIRECTOR / ADMIN ====================
      case 1: // Director
      case 63: // Admin
        const [revenueData] = await db.execute(`
          SELECT DATE_FORMAT(created_at, '%b') as month, 
                 SUM(amount) as revenue,
                 COUNT(*) as incidents 
          FROM transactions 
          GROUP BY month ORDER BY created_at DESC LIMIT 6`);

        const [sitesCount] = await db.execute("SELECT COUNT(*) as count FROM sites");
        const [incidentsToday] = await db.execute(
          "SELECT COUNT(*) as count FROM incidents WHERE DATE(created_at) = CURDATE()"
        );

        dashboardData.kpis = {
          totalGuards: totalGuards[0].count,
          activeSites: sitesCount[0].count,
          revenue: revenueData.length ? revenueData[0].revenue : 0,
          incidentsToday: incidentsToday[0].count
        };

        dashboardData.charts.revenueTrend = revenueData;
        break;

      // ==================== MANAGERS (General + Operational) ====================
      case 2:  // General Manager
      case 62: // Operational Manager
        const [guardsOnDuty] = await db.execute(`
          SELECT COUNT(*) as count FROM shifts 
          WHERE DATE(shift_date) = CURDATE() AND status = 'active'`
        );

        const [pendingIncidents] = await db.execute(`
          SELECT COUNT(*) as count FROM incidents 
          WHERE status IN ('open', 'pending')`
        );

        dashboardData.kpis = {
          totalGuards: totalGuards[0].count,
          guardsOnDuty: guardsOnDuty[0].count,
          activeSites: 38, // You can make this dynamic
          pendingIncidents: pendingIncidents[0].count
        };

        // Site performance
        const [sitePerformance] = await db.execute(`
          SELECT s.site_name, COUNT(sh.id) as guards_assigned 
          FROM sites s 
          LEFT JOIN shifts sh ON sh.site_id = s.id 
          WHERE DATE(sh.shift_date) = CURDATE()
          GROUP BY s.id LIMIT 5`
        );

        dashboardData.charts.sitePerformance = sitePerformance;
        break;

      // ==================== SUPERVISOR ====================
      case 3:
        const [myTeam] = await db.execute(`
          SELECT COUNT(*) as count FROM users 
          WHERE supervisor_id = ?`, [userId]);

        const [myIncidents] = await db.execute(`
          SELECT COUNT(*) as count FROM incidents 
          WHERE reported_by = ? AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [userId]);

        dashboardData.kpis = {
          myGuards: myTeam[0].count,
          onDutyNow: 18, // Can be improved
          incidentsThisWeek: myIncidents[0].count
        };
        break;

      // ==================== GUARD ====================
      case 5:
      case 65:
        const [todayShift] = await db.execute(`
          SELECT * FROM shifts 
          WHERE user_id = ? AND DATE(shift_date) = CURDATE()
          LIMIT 1`, [userId]);

        dashboardData.roleSpecific = {
          currentShift: todayShift[0] || null
        };
        break;

      // ==================== ACCOUNTANT ====================
      case 30:
        const [financialSummary] = await db.execute(`
          SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
          FROM transactions 
          WHERE MONTH(created_at) = MONTH(CURDATE())`
        );

        dashboardData.kpis = {
          revenueThisMonth: financialSummary[0].revenue || 0,
          outstanding: 2100000,
          payroll: 4900000
        };
        break;

      // ==================== STORE KEEPER ====================
      case 10:
        const [lowStock] = await db.execute(`
          SELECT COUNT(*) as count FROM inventory 
          WHERE quantity <= min_stock`
        );

        dashboardData.kpis = {
          totalItems: 1284,
          lowStock: lowStock[0].count,
          issuedToday: 47
        };
        break;

      default:
        // Fallback for other roles
        dashboardData.kpis = { totalGuards: totalGuards[0].count };
    }

    res.json({
      success: true,
      ...dashboardData
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data"
    });
  }
};

module.exports = { getDashboardData };