import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import webpush from "web-push";
import "dotenv/config";
import { randomInt } from "crypto";

import { queries, initDb } from "./db.js";
import { generateToken, verifyToken } from "./auth.js";

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
const PORT = Number(process.env.PORT) || 4000;

// ─── Web Push (VAPID) ──────────────────────────────────────────────────────────

const vapidReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("[push] VAPID keys not configured — push notifications disabled");
}

// ─── Email ─────────────────────────────────────────────────────────────────────

const smtpReady = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

if (!smtpReady) {
  console.warn("[email] SMTP not configured — verification codes will be printed to the console");
}

const transporter = smtpReady
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendVerificationEmail(email, username, code) {
  if (!smtpReady) {
    console.log(`\n[email] Verification code for ${email}: ${code}\n`);
    return;
  }
  const from = process.env.SMTP_FROM || `Linkloop <${process.env.SMTP_USER}>`;
  await transporter.sendMail({
    from,
    to: email,
    subject: "Your Linkloop verification code",
    text: `Hi ${username},\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#000;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;min-height:100vh;">
<tr><td align="center" style="padding:48px 16px;">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;">
<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#3b82f6,#14b8a6);display:inline-flex;align-items:center;justify-content:center;font-size:22px;">💬</div>
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:14px 0 0;letter-spacing:-0.5px;">Linkloop<span style="color:#a78bfa;">.</span></h1>
</td></tr>
<tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px 32px;">
<h2 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 8px;">Verify your email</h2>
<p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 32px;">Hi ${username}, enter this code to complete your Linkloop registration:</p>
<div style="text-align:center;margin-bottom:32px;">
<div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px 40px;">
<span style="font-size:40px;font-weight:700;color:#a78bfa;letter-spacing:14px;">${code}</span>
</div>
</div>
<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;">Expires in 15 minutes &nbsp;·&nbsp; Ignore if you didn't request this</p>
</td></tr>
<tr><td align="center" style="padding-top:24px;">
<p style="color:rgba(255,255,255,0.15);font-size:12px;margin:0;">© 2025 Linkloop</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  });
}

async function sendPasswordResetEmail(email, username, code) {
  if (!smtpReady) {
    console.log(`\n[email] Password reset code for ${email}: ${code}\n`);
    return;
  }
  const from = process.env.SMTP_FROM || `Linkloop <${process.env.SMTP_USER}>`;
  await transporter.sendMail({
    from,
    to: email,
    subject: "Your Linkloop password reset code",
    text: `Hi ${username},\n\nYour password reset code is: ${code}\n\nIt expires in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#000;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;min-height:100vh;">
<tr><td align="center" style="padding:48px 16px;">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;">
<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#3b82f6,#14b8a6);display:inline-flex;align-items:center;justify-content:center;font-size:22px;">💬</div>
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:14px 0 0;letter-spacing:-0.5px;">Linkloop<span style="color:#a78bfa;">.</span></h1>
</td></tr>
<tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px 32px;">
<h2 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 8px;">Reset your password</h2>
<p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.6;margin:0 0 32px;">Hi ${username}, use this code to set a new password for your Linkloop account:</p>
<div style="text-align:center;margin-bottom:32px;">
<div style="display:inline-block;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px 40px;">
<span style="font-size:40px;font-weight:700;color:#a78bfa;letter-spacing:14px;">${code}</span>
</div>
</div>
<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;">Expires in 15 minutes &nbsp;·&nbsp; Ignore if you didn't request this</p>
</td></tr>
<tr><td align="center" style="padding-top:24px;">
<p style="color:rgba(255,255,255,0.15);font-size:12px;margin:0;">© 2025 Linkloop</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  });
}

function generateCode() {
  // 8-digit numeric: 90M possibilities, much harder to brute-force than 6-digit (1M)
  return randomInt(10_000_000, 100_000_000).toString();
}

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

app.use(morgan("dev"));
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "512kb" }));

// ─── Rate limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts — try again in 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many registrations from this IP — try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "Too many contact requests — slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Presence ──────────────────────────────────────────────────────────────────
const online = new Map();

function markOnline(userId, socketId) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
}

function markOffline(userId, socketId) {
  online.get(userId)?.delete(socketId);
  if (online.get(userId)?.size === 0) online.delete(userId);
}

function isOnline(userId) {
  return (online.get(userId)?.size ?? 0) > 0;
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });
  req.user = decoded;
  next();
}

// ─── REST ──────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ status: "ok", service: "Linkloop API" }));

app.post("/api/auth/register", registerLimiter, async (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "username, email, and password are required" });
  }
  if (password.length < 8 || !/\d/.test(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain at least one number" });
  }

  const taken = (await queries.getUserByEmail.get(email)) || (await queries.getUserByUsername.get(username));
  if (taken) return res.status(409).json({ error: "Username or email already in use" });

  const hash = await bcrypt.hash(password, 10);
  const code = generateCode();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await queries.upsertPending.run(email.trim(), username.trim(), hash, code, expiresAt);
  await sendVerificationEmail(email.trim(), username.trim(), code);

  res.status(200).json({ pending: true, email: email.trim() });
});

app.post("/api/auth/verify", authLimiter, async (req, res) => {
  const { email, code } = req.body ?? {};
  if (!email || !code) return res.status(400).json({ error: "email and code are required" });

  const pending = await queries.getPending.get(email);
  if (!pending) return res.status(400).json({ error: "No pending verification for this email" });
  if (Date.now() > Number(pending.expires_at)) {
    await queries.deletePending.run(email);
    return res.status(400).json({ error: "Code expired — please register again" });
  }
  if (pending.code !== code) return res.status(400).json({ error: "Invalid verification code" });

  const { lastInsertRowid: id } = await queries.createUser.run(pending.username, pending.email, pending.password_hash);
  await queries.deletePending.run(email);

  const user = { id, username: pending.username, email: pending.email, avatar: null };
  res.status(201).json({ token: generateToken(user), user });
});

app.post("/api/auth/resend", authLimiter, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const pending = await queries.getPending.get(email);
  if (!pending) return res.status(400).json({ error: "No pending verification for this email" });

  const code = generateCode();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await queries.upsertPending.run(pending.email, pending.username, pending.password_hash, code, expiresAt);
  await sendVerificationEmail(pending.email, pending.username, code);

  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const user = await queries.getUserByEmail.get(email);
  if (!user) return res.json({ ok: true }); // don't reveal whether email exists

  const code = generateCode();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await queries.upsertResetToken.run(email.trim(), code, expiresAt);
  await sendPasswordResetEmail(email.trim(), user.username, code);

  res.json({ ok: true });
});

app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  const { email, code, password } = req.body ?? {};
  if (!email || !code || !password) {
    return res.status(400).json({ error: "email, code, and password are required" });
  }
  if (password.length < 8 || !/\d/.test(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain at least one number" });
  }

  const token = await queries.getResetToken.get(email);
  if (!token) return res.status(400).json({ error: "No reset request found for this email" });
  if (Date.now() > Number(token.expires_at)) {
    await queries.deleteResetToken.run(email);
    return res.status(400).json({ error: "Code expired — please request a new one" });
  }
  if (token.code !== code) return res.status(400).json({ error: "Invalid reset code" });

  const hash = await bcrypt.hash(password, 10);
  await queries.updatePassword.run(hash, email);
  await queries.deleteResetToken.run(email);

  res.json({ ok: true });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const row = await queries.getUserByEmail.get(email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, username: row.username, email: row.email, avatar: row.avatar || null };
  res.json({ token: generateToken(user), user });
});

// ─── REST: Users ───────────────────────────────────────────────────────────────

app.get("/api/users", requireAuth, async (req, res) => {
  const rows = await queries.getUsersWithStatus.all(req.user.id);
  res.json(rows.map((u) => ({ ...u, online: isOnline(u.id) })));
});

app.post("/api/users/me/avatar", requireAuth, async (req, res) => {
  const { avatar } = req.body ?? {};
  if (!avatar || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(avatar)) {
    return res.status(400).json({ error: "Invalid image — only JPEG, PNG, WebP, and GIF are allowed" });
  }
  if (avatar.length > 500_000) {
    return res.status(400).json({ error: "Image too large (max ~375 KB)" });
  }
  await queries.updateAvatar.run(req.user.id, avatar);
  const userRooms = await queries.getUserRoomIds.all(req.user.id);
  const roomKeys = userRooms.map(({ room_id }) => `room:${room_id}`);
  if (roomKeys.length > 0) io.to(roomKeys).emit("user:avatar", { userId: req.user.id, avatar });
  res.json({ ok: true });
});

app.post("/api/contacts/request", requireAuth, contactLimiter, async (req, res) => {
  const { contactId } = req.body ?? {};
  if (!contactId || Number(contactId) === req.user.id) {
    return res.status(400).json({ error: "Invalid contactId" });
  }
  const target = await queries.getUserById.get(contactId);
  if (!target) return res.status(404).json({ error: "User not found" });

  await queries.sendContactRequest.run(req.user.id, contactId);

  online.get(contactId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.emit("contact:request", {
      from: { id: req.user.id, username: req.user.username },
    });
  });
  res.json({ ok: true });
});

app.post("/api/contacts/accept", requireAuth, async (req, res) => {
  const { requesterId } = req.body ?? {};
  if (!requesterId) return res.status(400).json({ error: "requesterId required" });

  await queries.acceptContactRequest.run(req.user.id, requesterId);

  online.get(requesterId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.emit("contact:accepted", {
      by: { id: req.user.id, username: req.user.username },
    });
  });
  res.json({ ok: true });
});

app.delete("/api/contacts/:contactId", requireAuth, async (req, res) => {
  const contactId = Number(req.params.contactId);
  if (!contactId) return res.status(400).json({ error: "Invalid contactId" });
  await queries.removeContact.run(req.user.id, contactId);
  res.json({ ok: true });
});

// ─── Role hierarchy ───────────────────────────────────────────────────────────
const ROLE_LEVEL = { owner: 4, admin: 3, moderator: 2, member: 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notifyNewRoom(roomId, memberIds, extra = {}) {
  memberIds.forEach((memberId) => {
    const socketIds = online.get(memberId);
    if (!socketIds) return;
    socketIds.forEach((sid) => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) {
        sock.join(`room:${roomId}`);
        sock.emit("room:new", { roomId, ...extra });
      }
    });
  });
}

function notifyMembers(members, event, payload) {
  members.forEach(({ id: memberId }) => {
    online.get(memberId)?.forEach((sid) => {
      io.sockets.sockets.get(sid)?.emit(event, payload);
    });
  });
}

// ─── REST: Rooms ───────────────────────────────────────────────────────────────

app.get("/api/rooms", requireAuth, async (req, res) => {
  const rows = await queries.getUserRooms.all(req.user.id);
  res.json(
    rows.map((r) => ({
      ...r,
      other_user_online: r.other_user_id ? isOnline(r.other_user_id) : false,
    })),
  );
});

app.post("/api/rooms/dm", requireAuth, async (req, res) => {
  const { targetUserId } = req.body ?? {};
  if (!targetUserId) return res.status(400).json({ error: "targetUserId required" });

  const target = await queries.getUserById.get(targetUserId);
  if (!target) return res.status(404).json({ error: "User not found" });

  const rel = await queries.getContactStatus.get(req.user.id, targetUserId);
  if (!rel || rel.status !== "accepted") {
    return res.status(403).json({ error: "You can only DM contacts" });
  }

  const existing = await queries.findDmRoom.get(req.user.id, targetUserId);
  if (existing) return res.json({ roomId: existing.id });

  const { lastInsertRowid: roomId } = await queries.createRoom.run(0, null);
  await queries.addMember.run(roomId, req.user.id);
  await queries.addMember.run(roomId, targetUserId);

  notifyNewRoom(roomId, [req.user.id, targetUserId]);
  res.status(201).json({ roomId });
});

app.post("/api/rooms/group", requireAuth, async (req, res) => {
  const { userIds, name } = req.body ?? {};
  if (!Array.isArray(userIds) || userIds.length < 1) {
    return res.status(400).json({ error: "At least 1 other member required" });
  }
  if (userIds.length > 49) {
    return res.status(400).json({ error: "Groups are limited to 50 members" });
  }
  if (!name?.trim()) {
    return res.status(400).json({ error: "Group name required" });
  }

  const rels = await Promise.all(userIds.map((uid) => queries.getContactStatus.get(req.user.id, uid)));
  if (rels.some((r) => !r || r.status !== "accepted")) {
    return res.status(403).json({ error: "All group members must be your contacts" });
  }

  const { lastInsertRowid: roomId } = await queries.createRoom.run(1, name.trim());
  const allMembers = [req.user.id, ...userIds];
  await Promise.all(allMembers.map((uid) => queries.addMember.run(roomId, uid)));
  await Promise.all(userIds.map((uid) => queries.setRoomNew.run(roomId, uid, req.user.username)));

  notifyNewRoom(roomId, allMembers, {
    isGroup: true,
    groupName: name.trim(),
    addedBy: req.user.username,
  });
  res.status(201).json({ roomId });
});

app.get("/api/rooms/:roomId/members", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) {
    return res.status(403).json({ error: "Not a member" });
  }
  res.json(await queries.getRoomMembers.all(roomId));
});

app.get("/api/rooms/:roomId/messages", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) {
    return res.status(403).json({ error: "Not a member of this room" });
  }
  await queries.markRoomSeen.run(roomId, req.user.id);
  const before = req.query.before ? Number(req.query.before) : null;
  const result = await queries.getRoomMessages.page(roomId, before);
  res.json(result);
});

app.delete("/api/rooms/:roomId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const room = await queries.getRoomById.get(roomId);
  const allMembers = await queries.getRoomMembers.all(roomId);
  const otherMembers = allMembers.filter((m) => m.id !== req.user.id);

  const isChannel = room?.type === "channel" || room?.type === "private_channel";

  if (isChannel) {
    const myRole = await queries.getMemberRole.get(roomId, req.user.id);
    if (myRole === "owner") {
      // Superadmin deletes the channel for everyone
      await queries.deleteRoom.run(roomId);
      notifyMembers(otherMembers, "room:deleted", { roomId });
    } else {
      const sysText = `${req.user.username} left the channel`;
      const { lastInsertRowid: msgId } = await queries.insertMessage.run(roomId, req.user.id, sysText, true);
      await queries.removeMember.run(roomId, req.user.id);
      io.to(`room:${roomId}`).emit("channel:member_left", {
        roomId,
        userId: req.user.id,
        username: req.user.username,
        channelName: room?.name || "",
        systemMessage: {
          id: msgId,
          text: sysText,
          system: true,
          created_at: Math.floor(Date.now() / 1000),
          user_id: req.user.id,
          username: req.user.username,
        },
      });
    }
  } else if (otherMembers.length <= 1) {
    // 2-person room (DM or group) — delete entirely for all
    await queries.deleteRoom.run(roomId);
    notifyMembers(otherMembers, "room:deleted", { roomId });
  } else {
    // 3+ member group — user leaves, room continues
    await queries.removeMember.run(roomId, req.user.id);
    notifyMembers(otherMembers, "room:member_left", {
      roomId,
      userId: req.user.id,
      username: req.user.username,
    });
  }

  res.json({ ok: true });
});

// ─── REST: Channels ────────────────────────────────────────────────────────────

const VALID_SLUG = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

app.post("/api/channels", requireAuth, async (req, res) => {
  const { name, slug, description, isPrivate } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "Channel name required" });
  if (!slug?.trim()) return res.status(400).json({ error: "Channel address required" });
  const cleanSlug = slug.trim().toLowerCase();
  if (!VALID_SLUG.test(cleanSlug)) {
    return res.status(400).json({ error: "Address must be lowercase letters, numbers, and dashes (e.g. my-channel)" });
  }

  const existing = await queries.getChannelBySlug.get(cleanSlug);
  if (existing) return res.status(409).json({ error: "Channel address already taken" });

  const { lastInsertRowid: roomId } = await queries.createChannel.run(
    name.trim(), cleanSlug, description?.trim() || null, !!isPrivate,
  );
  await queries.addMemberWithRole.run(roomId, req.user.id, "owner");

  notifyNewRoom(roomId, [req.user.id]);
  res.status(201).json({ roomId });
});

app.post("/api/channels/join", requireAuth, async (req, res) => {
  const { slug } = req.body ?? {};
  if (!slug?.trim()) return res.status(400).json({ error: "Channel address required" });
  const cleanSlug = slug.trim().toLowerCase().replace(/^#/, "");

  const channel = await queries.getChannelBySlug.get(cleanSlug);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  if (channel.type === "private_channel") {
    return res.status(403).json({ error: "This is a private channel — you need an invitation to join" });
  }

  const alreadyMember = await queries.isMember.get(channel.id, req.user.id);
  if (alreadyMember) return res.json({ roomId: channel.id });

  await queries.addMemberWithRole.run(channel.id, req.user.id, "member");
  await queries.insertMessage.run(channel.id, req.user.id, `${req.user.username} joined the channel`, true);

  online.get(req.user.id)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.join(`room:${channel.id}`);
  });
  io.to(`room:${channel.id}`).emit("channel:member_joined", {
    roomId: channel.id, userId: req.user.id, username: req.user.username,
    channelName: channel.name || "",
  });
  notifyNewRoom(channel.id, [req.user.id]);
  res.json({ roomId: channel.id });
});

app.get("/api/channels/lookup/:slug", requireAuth, async (req, res) => {
  const cleanSlug = req.params.slug.toLowerCase().replace(/^#/, "");
  const channel = await queries.getChannelBySlug.get(cleanSlug);
  if (!channel) return res.status(404).json({ error: "Channel not found" });
  const memberCount = await queries.memberCount.get(channel.id);
  const isMember = !!(await queries.isMember.get(channel.id, req.user.id));
  res.json({ ...channel, memberCount: memberCount.cnt, isMember });
});

app.patch("/api/channels/:roomId/members/:userId/role", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const targetId = Number(req.params.userId);
  const { role } = req.body ?? {};

  if (!role) return res.status(400).json({ error: "Role is required" });

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.admin) return res.status(403).json({ error: "Only admins and owners can assign roles" });

  const allowedRoles = myRole === "owner" ? ["owner", "admin", "moderator", "member"] : ["admin", "moderator", "member"];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

  const targetRole = await queries.getMemberRole.get(roomId, targetId);
  if (!targetRole) return res.status(404).json({ error: "User is not a member" });
  if (targetRole === "owner" && myRole !== "owner") return res.status(403).json({ error: "Cannot change the channel owner's role" });
  if (ROLE_LEVEL[myRole] <= ROLE_LEVEL[targetRole] && myRole !== "owner") return res.status(403).json({ error: "Insufficient permissions" });
  if (role !== "owner" && ROLE_LEVEL[myRole] <= ROLE_LEVEL[role]) return res.status(403).json({ error: "Cannot assign a role equal to or higher than yours" });

  // Transfer ownership: demote current owner to admin first
  if (role === "owner") {
    await queries.setMemberRole.run(roomId, req.user.id, "admin");
  }

  const [room, targetUser] = await Promise.all([
    queries.getRoomById.get(roomId),
    queries.getUserById.get(targetId),
    queries.setMemberRole.run(roomId, targetId, role),
  ]);
  const channelName = room?.name || "";

  // Persist role notification for the affected users so it survives a page reload
  const roleName = role.charAt(0).toUpperCase() + role.slice(1);
  const article  = /^[aeiou]/i.test(role) ? "an" : "a";
  const targetNotif = role === "owner"
    ? `${req.user.username} made you the Owner`
    : `${req.user.username} made you ${article} ${roleName}`;
  const notifWrites = [queries.setRoleNotification.run(roomId, targetId, targetNotif)];
  if (role === "owner") {
    notifWrites.push(queries.setRoleNotification.run(
      roomId, req.user.id,
      `You transferred ownership to ${targetUser?.username}`,
    ));
  }
  await Promise.all(notifWrites);

  io.to(`room:${roomId}`).emit("channel:role_changed", {
    roomId, userId: targetId, role, changedBy: req.user.username, channelName,
  });
  if (role === "owner") {
    io.to(`room:${roomId}`).emit("channel:role_changed", {
      roomId, userId: req.user.id, role: "admin", changedBy: req.user.username, channelName,
      transferredTo: targetUser?.username,
    });
  }
  res.json({ ok: true });
});

app.delete("/api/channels/:roomId/members/:userId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const targetId = Number(req.params.userId);

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.admin) return res.status(403).json({ error: "Only admins and owners can remove members" });

  const targetRole = await queries.getMemberRole.get(roomId, targetId);
  if (!targetRole) return res.status(404).json({ error: "User is not a member" });
  if (targetRole === "owner") return res.status(403).json({ error: "Cannot kick the channel owner" });
  if (ROLE_LEVEL[myRole] <= ROLE_LEVEL[targetRole]) return res.status(403).json({ error: "Insufficient permissions" });

  await queries.removeMember.run(roomId, targetId);

  // Force-remove the kicked user's sockets from the room
  online.get(targetId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.leave(`room:${roomId}`);
  });

  const [kickedUser, kickRoom] = await Promise.all([
    queries.getUserById.get(targetId),
    queries.getRoomById.get(roomId),
  ]);
  const kickPayload = {
    roomId, kickedUserId: targetId, kickedUsername: kickedUser?.username,
    kickedBy: req.user.username, channelName: kickRoom?.name || "",
  };

  io.to(`room:${roomId}`).emit("channel:member_kicked", kickPayload);
  // Also notify the kicked user's sockets (already left the room so won't get the broadcast)
  online.get(targetId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.emit("channel:member_kicked", kickPayload);
  });
  res.json({ ok: true });
});

// ─── Add member to channel ─────────────────────────────────────────────────────

app.post("/api/channels/:roomId/members", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "userId required" });

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.admin) return res.status(403).json({ error: "Only admins and owners can add members" });

  if (await queries.isMember.get(roomId, userId)) {
    return res.status(409).json({ error: "User is already a member" });
  }

  await queries.addMemberWithRole.run(roomId, userId, "member");
  await queries.setRoomNew.run(roomId, userId, req.user.username);

  online.get(userId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.join(`room:${roomId}`);
  });

  const [room, addedUser] = await Promise.all([
    queries.getRoomById.get(roomId),
    queries.getUserById.get(userId),
  ]);
  await queries.insertMessage.run(roomId, userId, `${addedUser?.username} joined the channel`, true);
  io.to(`room:${roomId}`).emit("channel:member_joined", {
    roomId, userId, username: addedUser?.username, addedBy: req.user.username,
    channelName: room?.name || "",
  });
  online.get(userId)?.forEach((sid) => {
    io.sockets.sockets.get(sid)?.emit("channel:added", { room, addedBy: req.user.username });
  });
  res.json({ ok: true });
});

// ─── Edit channel ──────────────────────────────────────────────────────────────

app.patch("/api/channels/:roomId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const { name, description, slug } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.admin) return res.status(403).json({ error: "Only admins and owners can edit the channel" });

  let cleanSlug = null;
  if (slug !== undefined && ROLE_LEVEL[myRole] >= ROLE_LEVEL.admin) {
    cleanSlug = slug.trim().toLowerCase();
    if (!VALID_SLUG.test(cleanSlug)) {
      return res.status(400).json({ error: "Address must be lowercase letters, numbers, and dashes (e.g. my-channel)" });
    }
    const existing = await queries.getChannelBySlug.get(cleanSlug);
    if (existing && existing.id !== roomId) {
      return res.status(409).json({ error: "Channel address already taken" });
    }
  }

  await queries.updateRoom.run(roomId, name.trim(), description?.trim() || null, cleanSlug);
  io.to(`room:${roomId}`).emit("channel:updated", {
    roomId, name: name.trim(), description: description?.trim() || null,
    ...(cleanSlug !== null && { slug: cleanSlug }),
  });
  res.json({ ok: true });
});

// ─── Mute member ──────────────────────────────────────────────────────────────

app.patch("/api/channels/:roomId/members/:userId/mute", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const targetId = Number(req.params.userId);
  const { duration } = req.body ?? {};  // seconds; 0 = unmute

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.moderator) return res.status(403).json({ error: "Only moderators and above can mute members" });

  const targetRole = await queries.getMemberRole.get(roomId, targetId);
  if (!targetRole) return res.status(404).json({ error: "User is not a member" });
  if (ROLE_LEVEL[myRole] <= ROLE_LEVEL[targetRole]) return res.status(403).json({ error: "Insufficient permissions" });

  const mutedUntil = duration > 0 ? Math.floor(Date.now() / 1000) + Number(duration) : null;
  const [, muteTarget, muteRoom] = await Promise.all([
    queries.setMuted.run(roomId, targetId, mutedUntil),
    queries.getUserById.get(targetId),
    queries.getRoomById.get(roomId),
  ]);

  io.to(`room:${roomId}`).emit("channel:member_muted", {
    roomId, userId: targetId, mutedUntil, mutedBy: req.user.username,
    targetUsername: muteTarget?.username, channelName: muteRoom?.name || "",
  });
  res.json({ ok: true, mutedUntil });
});

// ─── Pin messages ─────────────────────────────────────────────────────────────

app.post("/api/channels/:roomId/pins", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const { messageId } = req.body ?? {};

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.moderator) return res.status(403).json({ error: "Only moderators and above can pin messages" });

  const msg = await queries.getMessageById.get(messageId);
  if (!msg || msg.room_id !== roomId) return res.status(404).json({ error: "Message not found" });

  await queries.pinMessage.run(roomId, messageId, req.user.id);

  const pinned = { message_id: messageId, text: msg.text, author: msg.username, pinned_by: req.user.username, pinned_at: Math.floor(Date.now() / 1000) };
  io.to(`room:${roomId}`).emit("channel:message_pinned", { roomId, pinned });
  res.json({ ok: true });
});

app.delete("/api/channels/:roomId/pins/:messageId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  const messageId = Number(req.params.messageId);

  const myRole = await queries.getMemberRole.get(roomId, req.user.id);
  if (!myRole) return res.status(403).json({ error: "Not a member" });
  if (ROLE_LEVEL[myRole] < ROLE_LEVEL.moderator) return res.status(403).json({ error: "Only moderators and above can unpin messages" });

  await queries.unpinMessage.run(roomId, messageId);
  io.to(`room:${roomId}`).emit("channel:message_unpinned", { roomId, messageId });
  res.json({ ok: true });
});

app.get("/api/channels/:roomId/pins", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) return res.status(403).json({ error: "Not a member" });
  const pins = await queries.getPinnedMessages.all(roomId);
  res.json(pins);
});

// ─── Messages ─────────────────────────────────────────────────────────────────

app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const msg = await queries.getMessageById.get(messageId);
  if (!msg) return res.status(404).json({ error: "Not found" });
  if (!(await queries.isMember.get(msg.room_id, req.user.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const isOwnMessage = msg.user_id === req.user.id;
  if (!isOwnMessage) {
    const room = await queries.getRoomById.get(msg.room_id);
    const isChannel = room?.type === "channel" || room?.type === "private_channel";
    if (!isChannel) return res.status(403).json({ error: "You can only delete your own messages" });
    const myRole = await queries.getMemberRole.get(msg.room_id, req.user.id);
    if (!myRole || ROLE_LEVEL[myRole] < ROLE_LEVEL.moderator) {
      return res.status(403).json({ error: "Insufficient permissions to delete this message" });
    }
  }
  await queries.deleteMessageById.run(messageId);
  io.to(`room:${msg.room_id}`).emit("message:deleted", { roomId: msg.room_id, messageId });
  res.json({ ok: true });
});

// ─── Push subscription ─────────────────────────────────────────────────────────

app.post("/api/push/subscribe", requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }
  await queries.upsertPushSubscription.run(req.user.id, endpoint, keys.p256dh, keys.auth);
  res.json({ ok: true });
});

app.delete("/api/push/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  await queries.deletePushSubscription.run(req.user.id, endpoint);
  res.json({ ok: true });
});

// ─── Socket.io auth middleware ─────────────────────────────────────────────────

io.use((socket, next) => {
  const decoded = verifyToken(socket.handshake.auth?.token);
  if (!decoded) return next(new Error("Authentication error"));
  socket.user = decoded;
  next();
});

// ─── Socket.io events ──────────────────────────────────────────────────────────

io.on("connection", async (socket) => {
  const { id: userId, username } = socket.user;

  // Was this user fully offline before this socket connected? (Used to avoid
  // re-announcing "online" every time the same user opens an extra tab.)
  const wasOffline = !isOnline(userId);
  markOnline(userId, socket.id);
  await queries.touchUser.run(userId);

  const userRooms = await queries.getUserRoomIds.all(userId);
  const roomKeys = userRooms.map(({ room_id }) => `room:${room_id}`);
  roomKeys.forEach((key) => socket.join(key));

  // ── Presence ───────────────────────────────────────────────────────────────
  // Online status is already globally visible (GET /api/users returns every
  // user's `online` flag to any authenticated user), so presence is broadcast
  // to all connected clients — not just room-mates. This is what makes the
  // online dots update live for contacts who don't yet share a room, and for
  // rooms created/joined mid-session (which a connect-time closure would miss).
  //
  // 1) Give the freshly-connected socket the current online snapshot so its
  //    dots are correct immediately, independent of the REST call's timing.
  for (const otherId of online.keys()) {
    if (otherId !== userId) socket.emit("user:status", { userId: otherId, online: true });
  }
  // 2) Announce this user to everyone else — only on the first tab/socket, so
  //    opening additional tabs doesn't spam redundant "online" events.
  if (wasOffline) {
    socket.broadcast.emit("user:status", { userId, online: true });
  }

  socket.on("message:send", async ({ roomId, text, tempId }) => {
    if (!text?.trim() || !roomId) return;
    if (text.trim().length > 4000) {
      socket.emit("message:error", { tempId, error: "Message too long (max 4,000 characters)" });
      return;
    }
    if (!(await queries.isMember.get(roomId, userId))) return;

    const mutedUntil = await queries.getMuted.get(roomId, userId);
    if (mutedUntil && mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = new Date(mutedUntil * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      socket.emit("message:error", { tempId, error: `You are muted until ${remaining}` });
      return;
    }

    const { lastInsertRowid: msgId } = await queries.insertMessage.run(roomId, userId, text.trim());
    const message = await queries.getMessageById.get(msgId);

    socket.to(`room:${roomId}`).emit("message:new", { roomId, message });
    socket.emit("message:ack", { tempId, message, roomId });

    // Web Push — notify members who are offline or have the app backgrounded
    if (vapidReady) {
      try {
        const [subs, room] = await Promise.all([
          queries.getPushSubscriptionsForRoom.all(roomId, userId),
          queries.getRoomById.get(roomId),
        ]);
        if (subs.length > 0) {
          const isGroup = !!(room?.is_group);
          const pushTitle = isGroup ? (room?.name || "Group Chat") : username;
          const pushBody = isGroup ? `${username}: ${text.trim().slice(0, 120)}` : text.trim().slice(0, 120);
          const payload = JSON.stringify({ title: pushTitle, body: pushBody, roomId, icon: "/favicon.svg" });
          subs.forEach((sub) => {
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            ).catch((err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription expired or no longer valid — remove it
                queries.deletePushSubscription.run(sub.user_id, sub.endpoint).catch(() => {});
              } else {
                console.error("[push] Send failed:", err.statusCode, err.message?.slice(0, 80));
              }
            });
          });
        }
      } catch (pushErr) {
        console.error("[push] Error sending push:", pushErr.message);
      }
    }
  });

  socket.on("message:react", async ({ messageId, emoji }) => {
    const msg = await queries.getMessageById.get(messageId);
    if (!msg || !(await queries.isMember.get(msg.room_id, userId))) return;

    const newReaction = msg.reaction === emoji ? null : emoji;
    await queries.setReaction.run(newReaction, messageId);

    io.to(`room:${msg.room_id}`).emit("message:reaction", {
      roomId: msg.room_id,
      messageId,
      emoji: newReaction,
    });
  });

  // Persist that this user has read a room (advances last_read_at), so unread
  // counts survive a reload / app close and reconcile across devices.
  socket.on("room:read", async ({ roomId }) => {
    if (!roomId) return;
    if (!(await queries.isMember.get(roomId, userId))) return;
    await queries.markRoomSeen.run(roomId, userId);
  });

  socket.on("typing:start", async ({ roomId }) => {
    if (!(await queries.isMember.get(roomId, userId))) return;
    socket.to(`room:${roomId}`).emit("typing:update", { roomId, userId, username, typing: true });
  });

  socket.on("typing:stop", async ({ roomId }) => {
    if (!(await queries.isMember.get(roomId, userId))) return;
    socket.to(`room:${roomId}`).emit("typing:update", { roomId, userId, username, typing: false });
  });

  socket.on("disconnect", async () => {
    markOffline(userId, socket.id);
    await queries.touchUser.run(userId);
    // Only announce "offline" once the user's last tab/socket has gone away.
    if (!isOnline(userId)) {
      io.emit("user:status", { userId, online: false });
    }
  });
});

// ─── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required — server will not start without it");
  }
  await initDb();
  httpServer.listen(PORT, () => console.log(`Linkloop server → http://localhost:${PORT}`));
}

start();
