export const attachPermissions = (db) => async (req, res, next) => {
  try {
    const roleId = req.user?.role_id;
    if (!roleId) return res.status(401).json({ message: "Role tidak ditemukan" });

    const [rows] = await db.execute(
      `SELECT can_create, can_read, can_view, can_update, can_approve, can_delete, can_provision
       FROM role_permissions
       WHERE role_id = ?
       LIMIT 1`,
      [roleId]
    );

    const p = rows?.[0] || {};
    req.perms = {
      can_create: !!p.can_create,
      can_read: !!p.can_read,
      can_view: !!p.can_view,
      can_update: !!p.can_update,
      can_approve: !!p.can_approve,
      can_delete: !!p.can_delete,
      can_provision: !!p.can_provision,
    };

    next();
  } catch (err) {
    console.error("attachPermissions error:", err);
    res.status(500).json({ message: "RBAC error" });
  }
};


export const authorizePerm = (permKey) => (req, res, next) => {
  if (!req.perms?.[permKey]) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};


// Cek role: authorizeRoles(2,3,5)
export const authorizeRoles = (...allowedRoleIds) => {
  return (req, res, next) => {
    const roleId = req.user?.role_id;
    if (!roleId || !allowedRoleIds.includes(roleId)) {
      return res.status(403).json({ message: "Forbidden (role not allowed)" });
    }
    next();
  };
};
