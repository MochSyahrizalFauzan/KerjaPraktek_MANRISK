import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { authenticateToken } from "./middleware/auth.js";
import { attachPermissions, authorizePerm } from "./middleware/rbac.js";

const app = express();
app.use(
  cors({
    origin: ["http://localhost:9002"], // port frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = "access_secret_key"; // nanti taro di .env
const REFRESH_SECRET = "refresh_secret_key"; // nanti taro di .env

const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'smart_database',
});

function requirePerm(req, res, permKey) {
  if (!req.perms?.[permKey]) {
    res.status(403).json({ message: "Forbidden" });
    return true;
  }
  return false;
}

// Helper: pastikan master published & aktif untuk unit
async function assertMasterPublishedForUnit(db, rcsa_master_id, unit_id) {
  const [rows] = await db.execute(
    `
    SELECT m.id
    FROM rcsa_master m
    JOIN rcsa_master_units mu ON mu.rcsa_master_id = m.id
    WHERE m.id = ?
      AND mu.unit_id = ?
      AND mu.is_active = 1
      AND m.status = 'published'
    LIMIT 1
  `,
    [rcsa_master_id, unit_id]
  );

  return rows.length > 0;
}



// ======== USERS =============

// Ambil semua user + role + unit + permissions
app.get('/users', authenticateToken(db), async (req, res) => {
  const [rows] = await db.execute(`
    SELECT 
      u.id, 
      u.user_id, 
      u.name, 
      u.email, 
      u.unit_id, 
      u.status, 
      r.role_name,
      un.unit_name,
      rp.can_create, 
      rp.can_read, 
      rp.can_view, 
      rp.can_update, 
      rp.can_approve, 
      rp.can_delete, 
      rp.can_provision
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN units un ON u.unit_id = un.id
  `);
  res.json(rows);
});


// Tambah user
app.post('/users', async (req, res) => {
  const { user_id, name, email, password, unit_id, role_id, status } = req.body;
  if (!user_id || !name || !password || !unit_id || !role_id) {
    return res.status(400).json({ message: 'Data tidak lengkap (user_id, name, password, role_id wajib)' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.execute(
    `INSERT INTO users (user_id, name, email, password, unit_id, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
     [user_id, name, email || null, hashedPassword, unit_id, role_id, status || 'active']
  );

  res.json({ message: 'User berhasil ditambahkan' });
});

// =======================================================
// ROLES + PERMISSIONS
// =======================================================

// GET roles + permissions
app.get('/roles', async (req, res) => {
  const [rows] = await db.execute(`
    SELECT r.id, r.role_name, r.description,
          rp.can_create, rp.can_read, rp.can_view, rp.can_update,
          rp.can_approve, rp.can_delete, rp.can_provision
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
  `);
  res.json(rows);
});

// FIX: hanya 1 route
app.get('/roles/:roleId/permissions', async (req, res) => {
  const { roleId } = req.params;

  const [rows] = await db.execute(`
    SELECT can_create, can_read, can_view, can_update,
          can_approve, can_delete, can_provision
    FROM role_permissions
    WHERE role_id = ?
  `, [roleId]);

  res.json(rows[0] || {});
});

// ======== ME (SESSION CHECK) ========
app.get("/me", authenticateToken(db), attachPermissions(db), async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });

  try {
    const [rows] = await db.execute(
      `SELECT u.*, r.role_name, un.unit_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN units un ON u.unit_id = un.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ message: "User tidak ditemukan" });

    const user = rows[0];

    res.status(200).json({
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      unit_id: user.unit_id,
      unit_name: user.unit_name,
      status: user.status,
      permissions: req.perms, // ✅ dari middleware
    });
  } catch (err) {
    console.error("❌ Error /me:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// ===========================================================
// ===================== AUTH SECTION ========================
// ===========================================================

// === LOGIN ===
app.post("/login", async (req, res) => {
  const { user_id, password } = req.body;

  try {
    const [rows] = await db.execute(
      `SELECT u.*, r.role_name, un.unit_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN units un ON u.unit_id = un.id
       WHERE u.user_id = ?`,
      [user_id]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "ID User tidak ditemukan" });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await db.execute(
        `INSERT INTO user_logins (user_id, ip_address, user_agent, success, role_name, unit_name)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [user.id, req.ip, req.get("User-Agent"), user.role_name, user.unit_name]
      );

      console.warn(`[LOGIN FAIL] ${user_id} — Password salah`);
      return res.status(401).json({ message: "Password salah" });
    }

    // Ambil permissions
    const [permRows] = await db.execute(
      `SELECT can_create, can_read, can_view, can_update, can_approve, can_delete, can_provision
       FROM role_permissions WHERE role_id = ?`,
      [user.role_id]
    );
    const permissions = permRows[0] || {};

    //  Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const refreshToken = jwt.sign(
      { id: user.id, role_id: user.role_id },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // === Simpan cookies aman ===
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",   
      secure: false,     // true jika pakai HTTPS
      path: "/",
      maxAge: 60 * 60 * 1000, // 1 jam
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });

    // Catat login sukses
    await db.execute(
      `INSERT INTO user_logins (user_id, ip_address, user_agent, success, role_name, unit_name)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [user.id, req.ip, req.get("User-Agent"), user.role_name, user.unit_name]
    );

    console.log(`[LOGIN SUCCESS] ${user_id} (${user.name}) berhasil login`);

    // Tidak perlu kirim token ke frontend
    res.json({
      message: "Login success",
      user: {
        id: user.id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        unit_id: user.unit_id,
        unit_name: user.unit_name,
        status: user.status,
        permissions,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======== REFRESH TOKEN =========
app.post("/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh token tidak ada" });

  jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: "Refresh token tidak valid" });

    const newAccessToken = jwt.sign(
      { id: decoded.id, role_id: decoded.role_id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set ulang accessToken ke cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 1000,
    });

    res.json({ message: "Token diperbarui" });
  });
});

// === LOGOUT ===
app.post("/logout", authenticateToken(db), async (req, res) => {
  try {
    const userId = req.user.id;

    await db.execute(
      `UPDATE user_logins 
       SET logout_time = NOW() 
       WHERE user_id = ? AND logout_time IS NULL
       ORDER BY login_time DESC LIMIT 1`,
      [userId]
    );

    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });  

    console.log(`[LOGOUT] User ID ${userId} logout`);
    res.json({ message: "Logout berhasil" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======== USER LOGINS (riwayat login/logout) =========
app.get("/user-logins", authenticateToken(db), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        ul.id,
        ul.user_id,
        u.name AS user_name,
        u.email,
        ul.login_time,
        ul.logout_time,
        ul.ip_address,
        ul.user_agent,
        ul.role_name,
        ul.unit_name,
        u.status
      FROM user_logins ul
      JOIN users u ON ul.user_id = u.id
      ORDER BY ul.login_time DESC
    `);
    
    console.log(`[USER_LOGINS] ${rows.length} logins diambil pada ${new Date().toLocaleString()}`);
    res.json(rows);
  } catch (err) {
    console.error("Gagal mengambil data user_logins:", err);
    res.status(500).json({ message: "Gagal mengambil data user_logins" });
  }
});

// ======== PROTECTED PROFILE =========
app.get("/profile", authenticateToken(db), async (req, res) => {
  const [rows] = await db.execute(
    "SELECT id, user_id, name, email, role_id, unit_id, status FROM users WHERE id = ?",
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan" });
  res.json(rows[0]);
});

// =======================================================
// RISKS (Protected)
// =======================================================

// GET risks
app.get('/risks', authenticateToken(db), async (req, res) => {
  const [rows] = await db.execute(`
    SELECT r.*, rs.role_name AS jabatan, u.unit_id,
          un.unit_name AS unit_kerja, u.name AS pemilik_nama 
    FROM risks r
    LEFT JOIN users u ON r.pemilik_risiko = u.id
    LEFT JOIN roles rs ON u.role_id = rs.id
    LEFT JOIN units un ON u.unit_id = un.id
    ORDER BY r.id DESC
  `);
  res.json(rows);
});

// POST risks
app.post('/risks', authenticateToken(db), async (req, res) => {
  const data = req.body;
  const fields = Object.values(data).map(v => v ?? null);

  const [result] = await db.execute(`
    INSERT INTO risks (
      kategori_risiko, jenis_risiko, skenario_risiko, root_cause, dampak,
      dampak_keuangan, tingkat_dampak_keuangan, dampak_operasional, tingkat_dampak_operasional,
      dampak_reputasi, tingkat_dampak_reputasi, dampak_regulasi, tingkat_dampak_regulasi,
      skor_kemungkinan, tingkat_kemungkinan, nilai_risiko, tingkat_risiko,
      rencana_penanganan, deskripsi_rencana_penanganan, risiko_residual,
      kriteria_penerimaan_risiko, pemilik_risiko
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, fields);

  res.json({ id: result.insertId, ...data });
});

// PUT risks
app.put('/risks/:id', authenticateToken(db), async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const safe = (v) => v ?? null;

  const values = [
    safe(data.kategori_risiko), safe(data.jenis_risiko),
    safe(data.skenario_risiko), safe(data.root_cause),
    safe(data.dampak), safe(data.dampak_keuangan),
    safe(data.tingkat_dampak_keuangan), safe(data.dampak_operasional),
    safe(data.tingkat_dampak_operasional), safe(data.dampak_reputasi),
    safe(data.tingkat_dampak_reputasi), safe(data.dampak_regulasi),
    safe(data.tingkat_dampak_regulasi), safe(data.skor_kemungkinan),
    safe(data.tingkat_kemungkinan), safe(data.nilai_risiko),
    safe(data.tingkat_risiko), safe(data.rencana_penanganan),
    safe(data.deskripsi_rencana_penanganan), safe(data.risiko_residual),
    safe(data.kriteria_penerimaan_risiko), safe(data.pemilik_risiko),
    id
  ];

  await db.execute(`
    UPDATE risks SET 
      kategori_risiko=?, jenis_risiko=?, skenario_risiko=?, root_cause=?, dampak=?,
      dampak_keuangan=?, tingkat_dampak_keuangan=?, dampak_operasional=?, tingkat_dampak_operasional=?,
      dampak_reputasi=?, tingkat_dampak_reputasi=?, dampak_regulasi=?, tingkat_dampak_regulasi=?,
      skor_kemungkinan=?, tingkat_kemungkinan=?, nilai_risiko=?, tingkat_risiko=?,
      rencana_penanganan=?, deskripsi_rencana_penanganan=?, risiko_residual=?,
      kriteria_penerimaan_risiko=?, pemilik_risiko=?
    WHERE id=?`,
    values
  );

  res.json({ id, ...data });
});

// DELETE risks
app.delete('/risks/:id', authenticateToken(db), async (req, res) => {
  await db.execute(`DELETE FROM risks WHERE id=?`, [req.params.id]);
  res.json({ message: 'Risk deleted' });
});

// GET /api/risks/masters
app.get('/risks/masters', authenticateToken(db), async (req, res) => {
  try {
    // kriteria master: mis. banyak kolom NULL / status='draft'
    const [rows] = await db.execute(
      `SELECT id, kategori_risiko, jenis_risiko, skenario_risiko, pemilik_risiko, status, created_at
       FROM risks
       WHERE (nilai_risiko IS NULL AND rencana_penanganan IS NULL) OR status = 'draft'
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/risks/masters error', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// tambah data master
app.post('/risks/master', authenticateToken(db), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      kategori_risiko,
      jenis_risiko = null,
      skenario_risiko = null,
      pemilik_risiko = null, // id user/unit yang ditunjuk (boleh null)
      status = 'draft'
    } = req.body;

    if (!kategori_risiko) {
      return res.status(400).json({ message: 'kategori_risiko wajib diisi' });
    }

    const [result] = await db.execute(
      `INSERT INTO risks (
        kategori_risiko, jenis_risiko, skenario_risiko,
        root_cause, dampak, dampak_keuangan, tingkat_dampak_keuangan,
        dampak_operasional, tingkat_dampak_operasional, dampak_reputasi, tingkat_dampak_reputasi,
        dampak_regulasi, tingkat_dampak_regulasi, skor_kemungkinan, tingkat_kemungkinan,
        nilai_risiko, tingkat_risiko, rencana_penanganan, deskripsi_rencana_penanganan,
        risiko_residual, kriteria_penerimaan_risiko,
        pemilik_risiko, status, last_updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kategori_risiko,
        jenis_risiko,
        skenario_risiko,
        null, null, null, null,
        null, null, null, null,
        null, null, null, null,
        null, null, null, null, null, null,
        pemilik_risiko,
        status,
        userId
      ]
    );

    return res.json({ id: result.insertId, message: 'Master risk created' });
  } catch (err) {
    console.error('POST /risks/master error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// tambah data master (unit kerja melengkapi)
app.post('/risks/generate', authenticateToken(db), async (req, res) => {
  try {
    const { master_id, target_unit_id = null, pemilik_risiko = null } = req.body;

    if (!master_id) return res.status(400).json({ message: 'master_id required' });

    const [masters] = await db.execute(
      `SELECT kategori_risiko, jenis_risiko, skenario_risiko FROM risks WHERE id = ?`,
      [master_id]
    );

    if (!masters.length) return res.status(404).json({ message: 'Master not found' });

    const m = masters[0];

    const [result] = await db.execute(
      `INSERT INTO risks (
        kategori_risiko, jenis_risiko, skenario_risiko,
        pemilik_risiko
      ) VALUES (?, ?, ?, ?)`,
      [m.kategori_risiko, m.jenis_risiko, m.skenario_risiko, pemilik_risiko]
    );

    // Kalau ingin menyimpan info target_unit_id (jika ada kolom unit_id),
    // tambahkan di INSERT dan parameter. (Table risks saat ini gak punya kolom unit_id).
    return res.json({ id: result.insertId, message: 'Generated risk for unit' });
  } catch (err) {
    console.error('POST /risks/generate error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======== UNITS ===========
// GET semua units atau filter berdasarkan parent_id
app.get('/units', async (req, res) => {
  try {
    const { parent_id } = req.query;
    let query = `
      SELECT id, unit_name, unit_type, parent_id
      FROM units
    `;
    const params = [];

    if (parent_id === 'null') {
      query += ` WHERE parent_id IS NULL`;
    } else if (parent_id) {
      query += ` WHERE parent_id = ?`;
      params.push(parent_id);
    }

    query += `
      ORDER BY 
        CASE 
          WHEN unit_name = 'Kantor Pusat' THEN 0
          ELSE 1
        END,
        unit_name
    `;


    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal ambil data units' });
  }
});


// GET detail unit by ID
app.get("/units/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, unit_name, unit_type FROM units WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Unit tidak ditemukan" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil detail unit" });
  }
});


// ======== RCSA MASTER =============

// ======== ADMIN: detail master (target units + dipakai oleh unit mana) ========
app.get(
  "/rcsa/master/:id/detail",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_read"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ message: "ID tidak valid" });

      // Master info (optional kalau kamu butuh)
      const [masterRows] = await db.execute(
        `SELECT id, rcsa_name, description, status, created_at
         FROM rcsa_master
         WHERE id = ?`,
        [id]
      );
      const master = masterRows?.[0] || null;

      // Target units (assigned)
      const [targetUnits] = await db.execute(
        `
        SELECT u.id, u.unit_name, u.unit_type, rmu.is_active, rmu.assigned_at
        FROM rcsa_master_units rmu
        JOIN units u ON u.id = rmu.unit_id
        WHERE rmu.rcsa_master_id = ?
        ORDER BY u.unit_name ASC
        `,
        [id]
      );

      // Used by units (assessment exists)
      const [usedByUnits] = await db.execute(
        `
        SELECT
          u.id,
          u.unit_name,
          u.unit_type,
          COUNT(ra.id) AS used_assessment_count,
          MAX(ra.updated_at) AS last_used_at
        FROM rcsa_assessment ra
        JOIN units u ON u.id = ra.unit_id
        WHERE ra.rcsa_master_id = ?
        GROUP BY u.id, u.unit_name, u.unit_type
        ORDER BY u.unit_name ASC
        `,
        [id]
      );

      res.json({
        master,
        targetUnits,
        usedByUnits,
      });
    } catch (err) {
      console.error("GET /rcsa/master/:id/detail error:", err);
      res.status(500).json({ message: "Gagal ambil detail master" });
    }
  }
);

// ASSIGN units (ubah target unit sebelum submit approval)
app.post("/rcsa/master/:id/assign-units", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_provision")) return;

  const { id } = req.params;
  const { unit_ids } = req.body; // number[]

  if (!Array.isArray(unit_ids) || unit_ids.length === 0) {
    return res.status(400).json({ message: "unit_ids wajib array dan minimal 1" });
  }

  try {
    const [mRows] = await db.execute(`SELECT status FROM rcsa_master WHERE id=?`, [id]);
    if (!mRows.length) return res.status(404).json({ message: "Master tidak ditemukan" });

    if (mRows[0].status !== "draft") {
      return res.status(400).json({ message: "Assign unit hanya boleh saat status draft" });
    }

    await db.beginTransaction();

    // reset mapping lama
    await db.execute(`DELETE FROM rcsa_master_units WHERE rcsa_master_id=?`, [id]);

    // insert mapping baru (inactive dulu)
    for (const uid of unit_ids) {
      await db.execute(
        `INSERT INTO rcsa_master_units (rcsa_master_id, unit_id, is_active)
         VALUES (?, ?, 0)`,
        [id, uid]
      );
    }

    await db.commit();
    res.json({ message: "Unit target berhasil diperbarui", unit_ids });
  } catch (err) {
    await db.rollback();
    console.error(err);
    res.status(500).json({ message: "Gagal assign unit" });
  }
});


// ----------- CRUD MASTER RCSA ------------
//  Tambah Data Master RCSA
app.post(
  "/rcsa/master",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_create"),
  async (req, res) => {
    const { rcsa_name, description, unit_ids } = req.body;
    const created_by = req.user.id;

    if (!rcsa_name || !Array.isArray(unit_ids) || unit_ids.length === 0) {
      return res.status(400).json({ message: "rcsa_name dan unit_ids wajib diisi" });
    }

    try {
      await db.beginTransaction();

      const [result] = await db.execute(
        `INSERT INTO rcsa_master (rcsa_name, description, created_by, status)
         VALUES (?, ?, ?, 'draft')`,
        [rcsa_name, description || null, created_by]
      );

      const masterId = result.insertId;

      for (const uid of unit_ids) {
        await db.execute(
          `INSERT INTO rcsa_master_units (rcsa_master_id, unit_id, is_active)
           VALUES (?, ?, 0)`,
          [masterId, uid]
        );
      }

      await db.commit();
      res.json({ id: masterId, status: "draft" });
    } catch (err) {
      await db.rollback();
      console.error(err);
      res.status(500).json({ message: "Gagal tambah master RCSA" });
    }
  }
);



//  Update Master RCSA
app.put(
  "/rcsa/master/:id",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_update"),
  async (req, res) => {
    const { id } = req.params;
    const { rcsa_name, description } = req.body;

    try {
      const [mRows] = await db.execute(`SELECT status FROM rcsa_master WHERE id=?`, [id]);
      if (!mRows.length) return res.status(404).json({ message: "Master tidak ditemukan" });
      if (mRows[0].status !== "draft") {
        return res.status(400).json({ message: "Hanya master draft yang boleh diubah" });
      }

      await db.execute(
        `UPDATE rcsa_master SET rcsa_name=?, description=? WHERE id=?`,
        [rcsa_name, description || null, id]
      );

      res.json({ message: "Master berhasil diperbarui" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Gagal update master" });
    }
  }
);


//  Hapus Master RCSA
app.delete("/rcsa/master/:id", 
  authenticateToken(db), 
  attachPermissions(db), 
  authorizePerm("can_delete"),
  async (req, res) => {
  if (requirePerm(req, res, "can_delete")) return;

  const { id } = req.params;

  try {
    const [mRows] = await db.execute(`SELECT status FROM rcsa_master WHERE id=?`, [id]);
    if (!mRows.length) return res.status(404).json({ message: "Master tidak ditemukan" });

    if (mRows[0].status !== "draft") {
      return res.status(400).json({ message: "Hanya master draft yang boleh dihapus" });
    }

    const [useRows] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM rcsa_assessment WHERE rcsa_master_id=?`,
      [id]
    );
    if (useRows[0].cnt > 0) {
      return res.status(400).json({
        message: "Master sudah dipakai assessment. Tidak boleh delete. Silakan archive.",
      });
    }

    await db.execute("DELETE FROM rcsa_master_units WHERE rcsa_master_id=?", [id]);
    await db.execute("DELETE FROM rcsa_master WHERE id=?", [id]);

    res.json({ message: "Master RCSA berhasil dihapus" });
  } catch (err) {
    console.error("❌ Error hapus Master RCSA:", err);
    res.status(500).json({ message: "Gagal hapus master RCSA" });
  }
});

// ARCHIVE (buat master yang sudah dipakai)
app.post("/rcsa/master/:id/archive", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_update")) return;

  const { id } = req.params;

  try {
    // boleh archive kalau approved/published, dsb
    await db.execute(
      `UPDATE rcsa_master SET status='archived' WHERE id=?`,
      [id]
    );

    // nonaktifkan mapping unit
    await db.execute(
      `UPDATE rcsa_master_units SET is_active=0 WHERE rcsa_master_id=?`,
      [id]
    );

    res.json({ message: "Master berhasil di-archive" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal archive master" });
  }
});


//List master + summary
app.get("/rcsa/master/list", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_read")) return;

  try {
    const [rows] = await db.execute(`
      SELECT
        m.id,
        m.rcsa_name,
        m.description,
        m.status,
        m.created_at,
        u.name AS created_by_name,

        (SELECT COUNT(*) FROM rcsa_master_units mu WHERE mu.rcsa_master_id = m.id) AS target_units,
        (SELECT COUNT(*) FROM rcsa_assessment a WHERE a.rcsa_master_id = m.id) AS used_count,

        -- last decision/note
        (
          SELECT a2.decision
          FROM rcsa_master_approvals a2
          WHERE a2.rcsa_master_id = m.id
          ORDER BY a2.decided_at DESC, a2.created_at DESC
          LIMIT 1
        ) AS last_decision,

        (
          SELECT a2.note
          FROM rcsa_master_approvals a2
          WHERE a2.rcsa_master_id = m.id
          ORDER BY a2.decided_at DESC, a2.created_at DESC
          LIMIT 1
        ) AS last_note,

        (
          SELECT a2.decided_at
          FROM rcsa_master_approvals a2
          WHERE a2.rcsa_master_id = m.id
          ORDER BY a2.decided_at DESC, a2.created_at DESC
          LIMIT 1
        ) AS last_decided_at

      FROM rcsa_master m
      LEFT JOIN users u ON m.created_by = u.id
      ORDER BY m.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



//Submit approval - SINGLE APPROVER
app.post("/rcsa/master/:id/submit", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_update")) return;

  const { id } = req.params;

  try {
    const [mRows] = await db.execute(`SELECT status FROM rcsa_master WHERE id=?`, [id]);
    if (!mRows.length) return res.status(404).json({ message: "Master tidak ditemukan" });

    if (!["draft", "rejected"].includes(mRows[0].status)) {
      return res.status(400).json({ message: "Master harus draft/rejected untuk diajukan" });
    }

    const [mapRows] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM rcsa_master_units WHERE rcsa_master_id=?`,
      [id]
    );
    if (mapRows[0].cnt === 0) return res.status(400).json({ message: "Unit target belum dipilih" });

    await db.beginTransaction();

    await db.execute(`DELETE FROM rcsa_master_approvals WHERE rcsa_master_id=?`, [id]);

    await db.execute(
      `INSERT INTO rcsa_master_approvals (rcsa_master_id, step_order, role_id, approver_user_id, decision)
       VALUES (?, 1, NULL, NULL, 'pending')`,
      [id]
    );

    await db.execute(
      `UPDATE rcsa_master
       SET status='pending_approval', submitted_at=NOW(), submitted_by=?
       WHERE id=?`,
      [req.user.id, id]
    );

    await db.commit();
    res.json({ message: "Master diajukan untuk persetujuan (Approver: siapa pun yang punya can_approve)" });
  } catch (err) {
    await db.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


//Approval inbox (single approver: siapa pun yang can_approve)
app.get("/rcsa/master/approval/inbox",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_approve"),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          a.id AS approval_id,
          m.id,
          m.rcsa_name,
          m.description,
          m.status,
          m.created_at,
          u.name AS created_by_name,
          a.step_order,
          'Approver' AS required_role,
          a.approver_user_id,

          (SELECT COUNT(*)
           FROM rcsa_master_units mu
           WHERE mu.rcsa_master_id = m.id) AS target_unit_count,

          (SELECT GROUP_CONCAT(un.unit_name ORDER BY un.unit_name SEPARATOR ', ')
           FROM rcsa_master_units mu
           JOIN units un ON un.id = mu.unit_id
           WHERE mu.rcsa_master_id = m.id) AS target_units

        FROM rcsa_master m
        JOIN rcsa_master_approvals a ON a.rcsa_master_id = m.id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.status='pending_approval'
          AND a.decision='pending'
        ORDER BY m.created_at DESC
      `);

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Approve / Reject (single approver)
app.post("/rcsa/master/:id/decision",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_approve"),
  async (req, res) => {
    const { id } = req.params;
    const { decision, note } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision tidak valid" });
    }
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "Catatan wajib diisi" });
    }

    try {
      const [pendingSteps] = await db.execute(`
        SELECT id, approver_user_id
        FROM rcsa_master_approvals
        WHERE rcsa_master_id=? AND decision='pending'
        ORDER BY step_order ASC
        LIMIT 1
      `, [id]);

      if (!pendingSteps.length) return res.status(400).json({ message: "Tidak ada step approval yang pending" });

      const step = pendingSteps[0];

      await db.beginTransaction();

      // claim approver jika belum di-claim
      if (!step.approver_user_id) {
        const [claim] = await db.execute(
          `UPDATE rcsa_master_approvals
           SET approver_user_id=?
           WHERE id=? AND approver_user_id IS NULL`,
          [req.user.id, step.id]
        );
        // kalau 0 rows affected -> sudah di-claim orang lain
        if (claim.affectedRows === 0) {
          await db.rollback();
          return res.status(409).json({ message: "Approval sudah diambil oleh approver lain" });
        }
      } else if (step.approver_user_id !== req.user.id) {
        await db.rollback();
        return res.status(403).json({ message: "Approval ini sedang diproses approver lain" });
      }

      await db.execute(`
        UPDATE rcsa_master_approvals
        SET decision=?, note=?, reviewer_id=?, decided_at=NOW()
        WHERE id=?`,
        [decision, note.trim(), req.user.id, step.id]
      );

      if (decision === "rejected") {
        await db.execute(`
          UPDATE rcsa_master
          SET status='rejected', approved_at=NULL, approved_by=NULL
          WHERE id=?
        `, [id]);
        
        await db.commit();
        return res.json({ message: "Master ditolak (rejected)" });
      }


      await db.execute(`
        UPDATE rcsa_master
        SET status='approved', approved_at=NOW(), approved_by=?
        WHERE id=?`,
        [req.user.id, id]
      );

      await db.commit();
      return res.json({ message: "Master disetujui (approved), siap dipublish" });
    } catch (err) {
      await db.rollback();
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Publish (aktifkan untuk unit)
app.post("/rcsa/master/:id/publish", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_provision")) return;

  const { id } = req.params;

  try {
    const [mRows] = await db.execute(`SELECT status FROM rcsa_master WHERE id=?`, [id]);
    if (!mRows.length) return res.status(404).json({ message: "Master tidak ditemukan" });

    if (mRows[0].status !== "approved") {
      return res.status(400).json({ message: "Master harus approved sebelum publish" });
    }

    await db.beginTransaction();

    await db.execute(`
      UPDATE rcsa_master_units
      SET is_active=1, assigned_at=NOW()
      WHERE rcsa_master_id=?
    `, [id]);

    await db.execute(`
      UPDATE rcsa_master
      SET status='published'
      WHERE id=?
    `, [id]);

    await db.commit();
    res.json({ message: "Master berhasil dipublish ke semua unit target" });
  } catch (err) {
    await db.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// untuk unit kerja (dipakai di assessment drafts) 
// Unit kerja (current user unit) — aman
app.get("/rcsa/master/active", authenticateToken(db), async (req, res) => {
  try {
    const [me] = await db.execute(`SELECT unit_id FROM users WHERE id=?`, [req.user.id]);
    const unitId = me?.[0]?.unit_id;
    if (!unitId) return res.status(400).json({ message: "User belum punya unit" });

    const [rows] = await db.execute(`
      SELECT m.id, m.rcsa_name, m.description, u.unit_name
      FROM rcsa_master_units mu
      JOIN rcsa_master m ON m.id = mu.rcsa_master_id
      JOIN units u ON u.id = mu.unit_id
      WHERE mu.unit_id=?
        AND mu.is_active=1
        AND m.status='published'
      ORDER BY m.id ASC
    `, [unitId]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal ambil master aktif" });
  }
});

//Admin preview by unit (optional):
app.get("/rcsa/master/by-unit/:unitId", authenticateToken(db), attachPermissions(db), async (req, res) => {
  if (requirePerm(req, res, "can_read")) return;

  const { unitId } = req.params;

  const [rows] = await db.execute(`
    SELECT m.id, m.rcsa_name, m.description, mu.is_active, m.status
    FROM rcsa_master_units mu
    JOIN rcsa_master m ON m.id = mu.rcsa_master_id
    WHERE mu.unit_id=?
    ORDER BY m.id DESC
  `, [unitId]);

  res.json(rows);
});


// ======== RCSA ASSESSMENT =============
// Ambil semua assessment submitted (filter by user/unit/status)
app.get("/rcsa/assessment", authenticateToken(db), async (req, res) => {
  try {
    const { unit_id } = req.query;
    const user = req.user;
    const data = req.body;
    const created_by = req.user.id;

    //  BLOKIR jika master belum published / belum aktif untuk unit
    const ok = await assertMasterPublishedForUnit(db, data.rcsa_master_id, data.unit_id);
    if (!ok) {
      return res.status(403).json({
        message: "Master belum dipublish / belum aktif untuk unit ini. Tidak boleh membuat draft assessment.",
      });
    }


    let sql = `
      SELECT 
        ra.*, 
        u.unit_name, u.unit_type,
        rm.rcsa_name, rm.description AS rcsa_description
      FROM rcsa_assessment ra
      JOIN rcsa_master rm ON rm.id = ra.rcsa_master_id
      JOIN units u ON u.id = ra.unit_id
      WHERE ra.status = 'submitted'
    `;
    const params = [];

    if (unit_id) {
      sql += " AND ra.unit_id = ?";
      params.push(unit_id);
    }

    sql += " ORDER BY ra.id ASC";

    const [rows] = await db.execute(sql, params);
    console.log("RCSA Rows:", rows); // cek markicek
    res.json(rows);
    console.log(`User ${user.id} (${user.email}) mengambil data assessment`);
  } catch (err) {
    console.error("GET /rcsa/assessment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ambil assessment draft (gabungan master + draft user)
  app.get("/rcsa/assessment/drafts", authenticateToken(db), async (req, res) => {
  try {
    const { unit_id, exclude_submitted, incomplete_only } = req.query;
    const created_by = req.user.id;

    if (!unit_id) return res.status(400).json({ message: "unit_id wajib" });

    let sql = `
      SELECT 
        rmu.rcsa_master_id,
        rm.rcsa_name,
        rm.description AS keterangan_admin,
        rmu.unit_id,
        u.unit_name,
        u.unit_type,

        ra.id AS assessment_id,
        COALESCE(ra.status, 'draft') AS status,
        COALESCE(ra.potensi_risiko, rm.rcsa_name) AS potensi_risiko,

        ra.jenis_risiko,
        ra.penyebab_risiko,

        ra.dampak_inheren,
        ra.frekuensi_inheren,
        ra.nilai_inheren,
        ra.level_inheren,

        ra.pengendalian,

        ra.dampak_residual,
        ra.kemungkinan_residual,
        ra.nilai_residual,
        ra.level_residual,

        ra.action_plan,
        ra.pic,
        ra.keterangan_user

      FROM rcsa_master_units rmu
      JOIN rcsa_master rm ON rm.id = rmu.rcsa_master_id
      JOIN units u ON u.id = rmu.unit_id

      LEFT JOIN rcsa_assessment ra 
        ON ra.rcsa_master_id = rmu.rcsa_master_id
       AND ra.unit_id = rmu.unit_id
       AND ra.created_by = ?

      WHERE rmu.unit_id = ?
        AND rmu.is_active = 1
        AND rm.status = 'published'
    `;

    const params = [created_by, unit_id];

    if (exclude_submitted === "true") {
      sql += ` AND (ra.status IS NULL OR ra.status = 'draft') `;
    }

    if (incomplete_only === "true") {
      sql += `
        AND (
          ra.id IS NULL
          OR ra.jenis_risiko IS NULL OR ra.jenis_risiko = ''
          OR ra.penyebab_risiko IS NULL OR ra.penyebab_risiko = ''
          OR ra.dampak_inheren IS NULL
          OR ra.frekuensi_inheren IS NULL
          OR ra.pengendalian IS NULL OR ra.pengendalian = ''
          OR ra.dampak_residual IS NULL
          OR ra.kemungkinan_residual IS NULL
          OR ra.action_plan IS NULL OR ra.action_plan = ''
          OR ra.pic IS NULL OR ra.pic = ''
        )
      `;
    }

    sql += ` ORDER BY rmu.rcsa_master_id ASC`;

    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("drafts error:", err);
    res.status(500).json({ message: "Error fetching RCSA drafts" });
  }
  });

  // ======== USER: RIWAYAT ASSESSMENT YANG SUDAH DIREVIEW ========
  app.get("/rcsa/assessment/mine-reviewed", authenticateToken(db), async (req, res) => {
    const userId = req.user.id;
  
    try {
      const [rows] = await db.execute(
        `
        SELECT
          ra.id AS assessment_id,
          ra.potensi_risiko,
          u.unit_name,
      
          rn.decision,
          rn.note,
          rn.created_at AS reviewed_at,
          rv.name AS reviewer_name
      
        FROM rcsa_assessment ra
        JOIN units u ON u.id = ra.unit_id
      
        -- ambil NOTE TERBARU untuk assessment ini
        LEFT JOIN rcsa_review_notes rn
          ON rn.id = (
            SELECT rn2.id
            FROM rcsa_review_notes rn2
            WHERE rn2.assessment_id = ra.id
            ORDER BY rn2.created_at DESC
            LIMIT 1
          )
      
        LEFT JOIN users rv ON rv.id = rn.reviewer_id
      
        WHERE ra.created_by = ?
          AND ra.status = 'reviewed'
      
        ORDER BY ra.updated_at DESC
        `,
        [userId]
      );
    
      res.json(rows);
    } catch (err) {
      console.error("GET /rcsa/assessment/mine-reviewed error:", err);
      res.status(500).json({ message: "Gagal ambil riwayat reviewed" });
    }
  });

// ======== ADMIN REPORT: semua assessment yg status reviewed + keputusan terakhir ========
app.get(
  "/rcsa/report/reviewed",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_read"),
  async (req, res) => {
    try {
      const { unit_id } = req.query;

      let sql = `
        SELECT
          ra.*,
          un.unit_name,
          un.unit_type,

          rn.decision,
          rn.note,
          rv.name AS reviewer_name,
          rn.created_at AS reviewed_at

        FROM rcsa_assessment ra
        JOIN units un ON un.id = ra.unit_id

        LEFT JOIN rcsa_review_notes rn
          ON rn.id = (
            SELECT rn2.id
            FROM rcsa_review_notes rn2
            WHERE rn2.assessment_id = ra.id
            ORDER BY rn2.created_at DESC
            LIMIT 1
          )

        LEFT JOIN users rv ON rv.id = rn.reviewer_id

        WHERE ra.status = 'reviewed'
      `;

      const params = [];
      if (unit_id) {
        sql += ` AND ra.unit_id = ?`;
        params.push(unit_id);
      }

      sql += ` ORDER BY ra.updated_at DESC`;

      const [rows] = await db.execute(sql, params);
      res.json(rows);
    } catch (err) {
      console.error("GET /rcsa/report/reviewed error:", err);
      res.status(500).json({ message: "Gagal ambil laporan reviewed" });
    }
  }
);



// Ambil detail assessment by ID
app.get('/rcsa/assessment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT 
        ra.*,
        rm.id AS master_id, rm.rcsa_name, rm.description AS master_desc,
        u.id AS unit_id, u.unit_name, u.unit_type,
        usr.id AS user_id, usr.name AS user_name, usr.email AS user_email
      FROM rcsa_assessment ra
      JOIN rcsa_master rm ON ra.rcsa_master_id = rm.id
      JOIN units u ON ra.unit_id = u.id
      JOIN users usr ON ra.created_by = usr.id
      WHERE ra.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Assessment tidak ditemukan" });
    }

    const r = rows[0];
    const [notes] = await db.execute(`
      SELECT rn.id, rn.note, rn.created_at, u.id AS reviewer_id, u.name AS reviewer_name
      FROM rcsa_review_notes rn
      JOIN users u ON rn.reviewer_id = u.id
      WHERE rn.assessment_id = ?
    `, [id]);

    const formatted = {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      rcsa_master: {
        id: r.master_id,
        rcsa_name: r.rcsa_name,
        description: r.master_desc
      },
      unit: {
        id: r.unit_id,
        unit_name: r.unit_name,
        unit_type: r.unit_type
      },
      created_by: {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email
      },
      assessment: {
        jenis_risiko: r.jenis_risiko,
        risk_description: r.risk_description,
        penyebab_risiko: r.penyebab_risiko,
        dampak_inheren: r.dampak_inheren,
        frekuensi_inheren: r.frekuensi_inheren,
        nilai_inheren: r.nilai_inheren,
        level_inheren: r.level_inheren,
        pengendalian: r.pengendalian,
        dampak_residual: r.dampak_residual,
        kemungkinan_residual: r.kemungkinan_residual,
        nilai_residual: r.nilai_residual,
        level_residual: r.level_residual,
        action_plan: r.action_plan,
        pic: r.pic
      },
      review_notes: notes.map(n => ({
        id: n.id,
        note: n.note,
        created_at: n.created_at,
        reviewer: {
          id: n.reviewer_id,
          name: n.reviewer_name
        }
      }))
    };

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("❌ Error ambil detail assessment:", err);
    res.status(500).json({ message: 'Gagal ambil detail assessment' });
  }
});

// Update assessment draft
app.put("/rcsa/assessment/:id", authenticateToken(db), async (req, res) => {
  const { id } = req.params;
  let data = req.body;

  Object.keys(data).forEach((k) => {
    if (data[k] === undefined) data[k] = null;
  });

  try {
    // pastikan assessment milik user ini
    const [rows] = await db.execute(
      `SELECT created_by, status, rcsa_master_id, unit_id FROM rcsa_assessment WHERE id=?`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Assessment tidak ditemukan" });

    const a = rows[0];
    if (a.created_by !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    if (a.status === "submitted") return res.status(400).json({ message: "Sudah submitted, tidak bisa diubah" });

    // BLOKIR jika master belum published / mapping unit belum aktif
    const ok = await assertMasterPublishedForUnit(db, a.rcsa_master_id, a.unit_id);
    if (!ok) {
      return res.status(403).json({
        message: "Master belum dipublish / belum aktif untuk unit ini. Draft tidak bisa diubah.",
      });
    }

    await db.execute(
      `
      UPDATE rcsa_assessment SET
        potensi_risiko = ?, jenis_risiko = ?, penyebab_risiko = ?,
        dampak_inheren = ?, frekuensi_inheren = ?, nilai_inheren = ?, level_inheren = ?,
        pengendalian = ?,
        dampak_residual = ?, kemungkinan_residual = ?, nilai_residual = ?, level_residual = ?,
        action_plan = ?, pic = ?,
        keterangan_user = ?,
        status = 'draft'
      WHERE id = ?
    `,
      [
        data.potensi_risiko ?? null,
        data.jenis_risiko ?? null,
        data.penyebab_risiko ?? null,

        data.dampak_inheren ?? null,
        data.frekuensi_inheren ?? null,
        data.nilai_inheren ?? null,
        data.level_inheren ?? null,

        data.pengendalian ?? null,

        data.dampak_residual ?? null,
        data.kemungkinan_residual ?? null,
        data.nilai_residual ?? null,
        data.level_residual ?? null,

        data.action_plan ?? null,
        data.pic ?? null,

        data.keterangan_user ?? null,
        id,
      ]
    );

    res.json({ ...data, id: Number(id), status: "draft" });
  } catch (err) {
    console.error("❌ Error update assessment:", err);
    res.status(500).json({ message: "Gagal update assessment" });
  }
});

// tambah rcsa assessment
app.post("/rcsa/assessment", authenticateToken(db), async (req, res) => {

  console.log("🔥 POST /rcsa/assessment payload:", req.body);
  console.log("👤 created_by (from token):", req.user.id);

  const data = req.body;
  const created_by = req.user.id;

  try {
    const [existing] = await db.execute(
      `
      SELECT id, status FROM rcsa_assessment
      WHERE rcsa_master_id = ? AND unit_id = ? AND created_by = ?
      ORDER BY id DESC LIMIT 1
      `,
      [data.rcsa_master_id, data.unit_id, created_by]
    );

    // kalau sudah ada
    if (existing.length > 0) {
      const current = existing[0];
      console.log("POST /rcsa/assessment payload:", req.body);
      if (current.status === "submitted") {
        return res.status(400).json({
          success: false,
          message: "Assessment sudah submitted, tidak bisa membuat draft baru.",
        });
      }

      // UPDATE saat existing draft ditemukan
      await db.execute(
        `
        UPDATE rcsa_assessment SET
          potensi_risiko = ?, jenis_risiko = ?, penyebab_risiko = ?,
          dampak_inheren = ?, frekuensi_inheren = ?, nilai_inheren = ?, level_inheren = ?,
          pengendalian = ?,
          dampak_residual = ?, kemungkinan_residual = ?, nilai_residual = ?, level_residual = ?,
          action_plan = ?, pic = ?,
          keterangan_user = ?,
          status = 'draft'
        WHERE id = ?
        `,
        [
          data.potensi_risiko ?? null,
          data.jenis_risiko ?? null,
          data.penyebab_risiko ?? null,

          data.dampak_inheren ?? null,
          data.frekuensi_inheren ?? null,
          data.nilai_inheren ?? null,
          data.level_inheren ?? null,

          data.pengendalian ?? null,

          data.dampak_residual ?? null,
          data.kemungkinan_residual ?? null,
          data.nilai_residual ?? null,
          data.level_residual ?? null,

          data.action_plan ?? null,
          data.pic ?? null,

          data.keterangan_user ?? null,
          current.id,
        ]
      );

      return res.json({ ...data, id: current.id, status: "draft" });
    }

    // kalau belum ada, INSERT baru (ini yang sudah kamu betulkan placeholdernya)
    const [result] = await db.execute(
      `
      INSERT INTO rcsa_assessment (
        rcsa_master_id, unit_id, created_by,
        jenis_risiko, potensi_risiko, penyebab_risiko,
        dampak_inheren, frekuensi_inheren, nilai_inheren, level_inheren,
        pengendalian,
        dampak_residual, kemungkinan_residual, nilai_residual, level_residual,
        action_plan, pic, keterangan_user, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.rcsa_master_id ?? null,
        data.unit_id ?? null,
        created_by,

        data.jenis_risiko ?? null,
        data.potensi_risiko ?? null,
        data.penyebab_risiko ?? null,

        data.dampak_inheren ?? null,
        data.frekuensi_inheren ?? null,
        data.nilai_inheren ?? null,
        data.level_inheren ?? null,

        data.pengendalian ?? null,

        data.dampak_residual ?? null,
        data.kemungkinan_residual ?? null,
        data.nilai_residual ?? null,
        data.level_residual ?? null,

        data.action_plan ?? null,
        data.pic ?? null,

        data.keterangan_user ?? null,
        "draft",
      ]
    );

    res.json({ ...data, id: result.insertId, status: "draft" });
    console.log("POST /rcsa/assessment payload:", req.body);
  } catch (err) {
    console.error("❌ Error insert/upsert assessment:", err);
    console.log("POST /rcsa/assessment payload:", req.body);
    res.status(500).json({ message: "Gagal simpan assessment" });
  }
});



//submit Assessment
app.put("/rcsa/assessment/:id/submit", authenticateToken(db), async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT created_by, status, rcsa_master_id, unit_id,
        jenis_risiko, penyebab_risiko,
        dampak_inheren, frekuensi_inheren,
        pengendalian,
        dampak_residual, kemungkinan_residual,
        action_plan, pic
      FROM rcsa_assessment
      WHERE id = ?`,
      [id]
    );


    if (rows.length === 0) return res.status(404).json({ message: "Assessment tidak ditemukan" });

    const r = rows[0];

    //pastikan hanya pemilik draft yang bisa submit
    if (r.created_by !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (r.status === "submitted") {
      return res.status(400).json({ message: "Assessment sudah submitted" });
    }

    // BLOKIR SUBMIT jika master belum published / belum aktif untuk unit
    const ok = await assertMasterPublishedForUnit(db, r.rcsa_master_id, r.unit_id);
    if (!ok) {
      return res.status(403).json({
        message: "Master belum dipublish / belum aktif untuk unit ini. Tidak boleh submit assessment.",
      });
    }


    const missing = [];
    const reqText = (v) => v === null || v === undefined || String(v).trim() === "";
    const reqNum = (v) => v === null || v === undefined;

    if (reqText(r.jenis_risiko)) missing.push("jenis_risiko");
    if (reqText(r.penyebab_risiko)) missing.push("penyebab_risiko");
    if (reqNum(r.dampak_inheren)) missing.push("dampak_inheren");
    if (reqNum(r.frekuensi_inheren)) missing.push("frekuensi_inheren");
    if (reqText(r.pengendalian)) missing.push("pengendalian");
    if (reqNum(r.dampak_residual)) missing.push("dampak_residual");
    if (reqNum(r.kemungkinan_residual)) missing.push("kemungkinan_residual");
    if (reqText(r.action_plan)) missing.push("action_plan");
    if (reqText(r.pic)) missing.push("pic");

    if (missing.length) {
      return res.status(400).json({
        message: "Data assessment belum lengkap, tidak dapat disubmit",
        missing,
      });
    }

    await db.execute(`UPDATE rcsa_assessment SET status='submitted' WHERE id=?`, [id]);
    res.json({ message: "Assessment berhasil di-submit" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal submit assessment" });
  }
});


// ======== RCSA REVIEW =============
//GET Queue: ambil assessment status = submitted
app.get(
  "/rcsa/review/queue",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_approve"),
  async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT 
          ra.id,
          ra.status,
          ra.created_at,
          ra.updated_at,
          ra.potensi_risiko,
          ra.jenis_risiko,
          ra.penyebab_risiko,
          ra.pengendalian,
          ra.action_plan,
          ra.pic,
          ra.keterangan_user,

          ra.dampak_inheren, ra.frekuensi_inheren, ra.nilai_inheren, ra.level_inheren,
          ra.dampak_residual, ra.kemungkinan_residual, ra.nilai_residual, ra.level_residual,

          u.unit_name, u.unit_type,
          usr.name AS created_by_name, usr.user_id AS created_by_user_id,
          rm.rcsa_name, rm.description AS rcsa_description
        FROM rcsa_assessment ra
        JOIN units u ON u.id = ra.unit_id
        JOIN users usr ON usr.id = ra.created_by
        JOIN rcsa_master rm ON rm.id = ra.rcsa_master_id
        WHERE ra.status = 'submitted'
        ORDER BY ra.updated_at DESC
      `);

      res.json(rows);
    } catch (err) {
      console.error("GET /rcsa/review/queue error:", err);
      res.status(500).json({ message: "Gagal ambil queue review" });
    }
  }
);

//POST Review (approve/reject + note) + set status reviewed
app.post(
  "/rcsa/review/:assessmentId",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_approve"),
  async (req, res) => {
    const { assessmentId } = req.params;
    const reviewerId = req.user.id;
    const { note, decision } = req.body;

    if (!note || !decision) {
      return res.status(400).json({ message: "note & decision wajib" });
    }
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision tidak valid" });
    }

    try {
      const [rows] = await db.execute(
        `SELECT id, status FROM rcsa_assessment WHERE id=?`,
        [assessmentId]
      );
      if (!rows.length) return res.status(404).json({ message: "Assessment tidak ditemukan" });
      if (rows[0].status !== "submitted") {
        return res.status(400).json({ message: "Assessment bukan status submitted" });
      }

      await db.beginTransaction();

      await db.execute(
        `INSERT INTO rcsa_review_notes (assessment_id, reviewer_id, note, decision)
         VALUES (?, ?, ?, ?)`,
        [assessmentId, reviewerId, note, decision]
      );

      await db.execute(
        `UPDATE rcsa_assessment SET status='reviewed' WHERE id=?`,
        [assessmentId]
      );

      await db.commit();
      res.json({ success: true, message: "Review tersimpan" });
    } catch (err) {
      await db.rollback();
      console.error("POST /rcsa/review error:", err);
      res.status(500).json({ message: "Gagal simpan review" });
    }
  }
);

// GET notes by assessment
app.get(
  "/rcsa/review/:assessmentId/notes",
  authenticateToken(db),
  attachPermissions(db),
  authorizePerm("can_approve"),
  async (req, res) => {
    const { assessmentId } = req.params;
    try {
      const [rows] = await db.execute(
        `
        SELECT rn.id, rn.note, rn.decision, rn.created_at, u.name AS reviewer_name
        FROM rcsa_review_notes rn
        JOIN users u ON u.id = rn.reviewer_id
        WHERE rn.assessment_id = ?
        ORDER BY rn.created_at DESC
        `,
        [assessmentId]
      );
      res.json(rows);
    } catch (err) {
      console.error("GET notes error:", err);
      res.status(500).json({ message: "Gagal ambil notes" });
    }
  }
);








app.listen(5000, () => console.log('API running at http://localhost:5000'));