import jwt from "jsonwebtoken";

const JWT_SECRET = "access_secret_key";

export const authenticateToken = (db) => async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    // console.log("Cookies diterima:", req.cookies);

    if (!token) {
      return res.status(401).json({ message: "Akses ditolak, token tidak ada" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded = { id, role_id, iat, exp }

    //  ambil user lengkap dari DB (role_id + unit_id pasti ada)
    const [rows] = await db.execute(
      `SELECT u.id, u.user_id, u.name, u.email, u.unit_id, u.role_id, u.status
       FROM users u
       WHERE u.id = ? LIMIT 1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    req.user = rows[0]; // sekarang punya unit_id dan role_id
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token tidak valid atau kadaluarsa" });
  }
};
