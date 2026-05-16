// backend/middleware/rbac.js
const { hasModuleAccess } = require('../utils/rolePermissions');

const checkAccess = (requiredModule) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Role information missing."
      });
    }

    if (hasModuleAccess(req.user.role_id, requiredModule)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. You don't have permission to access ${requiredModule} module.`
    });
  };
};

module.exports = { checkAccess };