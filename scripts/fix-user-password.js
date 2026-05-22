import bcrypt from "bcryptjs";
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

// ── Config ────────────────────────────────────────────────────────────────────
const EMAIL = "dbuser@gmail.com";
const PASSWORD = "EnigmaDesign040993"; // ← change this to the password you want

// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  // eslint-disable-next-line no-undef
  connectionString: process.env.DATABASE_URL,
  // eslint-disable-next-line no-undef
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const hash = await bcrypt.hash(PASSWORD, 10);
const result = await pool.query(
  "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, username, email",
  [hash, EMAIL],
);

if (result.rowCount === 0) {
  console.error(`No user found with email: ${EMAIL}`);
} else {
  console.log("Password updated successfully for:", result.rows[0]);
  console.log("You can now log in with:", EMAIL, "/", PASSWORD);
}

await pool.end();
