import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "chatloop-dev-secret-change-in-production";

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
