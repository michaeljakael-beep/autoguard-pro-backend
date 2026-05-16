// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth: No Bearer token provided');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ Auth: Token missing after Bearer');
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is missing.'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-me-2026'
    );

    console.log('✅ JWT Decoded successfully for:', decoded.email || decoded.national_id);

    // Attach comprehensive user data to req.user
    req.user = {
      national_id: decoded.national_id || null,
      staff_id: decoded.staff_id || null,
      user_id: decoded.user_id || decoded.staff_id || null,
      
      first_name: decoded.first_name || null,
      surname: decoded.surname || null,
      email: decoded.email || null,
      role: decoded.role ? decoded.role.toLowerCase() : null,
      
      // Additional useful fields
      zone: decoded.zone || null,
      county: decoded.county || null,
      site_id: decoded.site_id || null,
      shift_type: decoded.shift_type || null,
      role_id: decoded.role_id || null,
    };

    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * Role-based authorization middleware
 * Usage: authorize('admin', 'hr', 'director')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User role not found.'
      });
    }

    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of these roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};