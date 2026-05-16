// backend/utils/rolePermissions.js
const rolePermissions = {
  1:  { name: "Director",              level: "full",     modules: ["all"] },
  2:  { name: "General Manager",      level: "high",      modules: ["all", "operations", "reports", "dashboard"] },
  3:  { name: "Supervisor",           level: "medium",    modules: ["dashboard", "shifts", "team", "reports"] },
  4:  { name: "HR",                   level: "hr",        modules: ["hr", "employees", "reports"] },
  5:  { name: "Employee",             level: "low",       modules: ["personal", "shifts", "dashboard"] },
  10: { name: "Store Keeper",         level: "inventory", modules: ["inventory", "dashboard"] },
  30: { name: "Accountant",           level: "finance",   modules: ["finance", "reports", "dashboard"] },
  62: { name: "Operational Manager",  level: "high",      modules: ["all", "operations", "dashboard"] },
  63: { name: "Admin",                level: "full",      modules: ["all"] },
  64: { name: "Sales and Marketing",  level: "sales",     modules: ["sales", "clients", "reports", "dashboard"] },
  65: { name: "Guard",                level: "guard",     modules: ["personal", "shifts", "dashboard"] },
  70: { name: "Client",               level: "client",    modules: ["client_portal", "reports"] }
};

const hasModuleAccess = (role_id, requiredModule) => {
  if (!role_id) return false;
  const role = rolePermissions[role_id];
  if (!role) return false;
  return role.modules.includes("all") || role.modules.includes(requiredModule);
};

module.exports = { 
  rolePermissions, 
  hasModuleAccess 
};