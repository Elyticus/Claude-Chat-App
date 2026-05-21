import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import "dotenv/config";

import { queries, initDb } from "./db.js";
import { generateToken, verifyToken } from "./auth.js";

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
const PORT = Number(process.env.PORT) || 4000;

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

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

app.get("/", (req, res) => res.json({ status: "ok", service: "Chatloop API" }));

app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "username, email, and password are required" });
  }

  const taken = (await queries.getUserByEmail.get(email)) || (await queries.getUserByUsername.get(username));
  if (taken) return res.status(409).json({ error: "Username or email already in use" });

  const hash = await bcrypt.hash(password, 10);
  const { lastInsertRowid: id } = await queries.createUser.run(username.trim(), email.trim(), hash);

  const user = { id, username: username.trim(), email: email.trim() };
  res.status(201).json({ token: generateToken(user), user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const row = await queries.getUserByEmail.get(email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, username: row.username, email: row.email };
  res.json({ token: generateToken(user), user });
});

// ─── REST: Users ───────────────────────────────────────────────────────────────

app.get("/api/users", requireAuth, async (req, res) => {
  const rows = await queries.getAllUsersExcept.all(req.user.id);
  res.json(rows.map((u) => ({ ...u, online: isOnline(u.id) })));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notifyNewRoom(roomId, memberIds) {
  memberIds.forEach((memberId) => {
    const socketIds = online.get(memberId);
    if (!socketIds) return;
    socketIds.forEach((sid) => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) {
        sock.join(`room:${roomId}`);
        sock.emit("room:new", { roomId });
      }
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
  if (!name?.trim()) {
    return res.status(400).json({ error: "Group name required" });
  }

  const { lastInsertRowid: roomId } = await queries.createRoom.run(1, name.trim());
  const allMembers = [req.user.id, ...userIds];
  await Promise.all(allMembers.map((uid) => queries.addMember.run(roomId, uid)));

  notifyNewRoom(roomId, allMembers);
  res.status(201).json({ roomId });
});

app.get("/api/rooms/:roomId/messages", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) {
    return res.status(403).json({ error: "Not a member of this room" });
  }
  res.json(await queries.getRoomMessages.all(roomId));
});

app.delete("/api/rooms/:roomId", requireAuth, async (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!(await queries.isMember.get(roomId, req.user.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await queries.removeMember.run(roomId, req.user.id);
  const { cnt } = await queries.memberCount.get(roomId);
  if (cnt === 0) await queries.deleteRoom.run(roomId);
  res.json({ ok: true });
});

app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const msg = await queries.getMessageById.get(messageId);
  if (!msg) return res.status(404).json({ error: "Not found" });
  if (!(await queries.isMember.get(msg.room_id, req.user.id))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await queries.deleteMessage.run(messageId, req.user.id);
  io.to(`room:${msg.room_id}`).emit("message:deleted", { roomId: msg.room_id, messageId });
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

  markOnline(userId, socket.id);
  await queries.touchUser.run(userId);

  const userRooms = await queries.getUserRoomIds.all(userId);
  userRooms.forEach(({ room_id }) => socket.join(`room:${room_id}`));

  socket.broadcast.emit("user:status", { userId, online: true });

  socket.on("message:send", async ({ roomId, text, tempId }) => {
    if (!text?.trim() || !roomId) return;
    if (!(await queries.isMember.get(roomId, userId))) return;

    const { lastInsertRowid: msgId } = await queries.insertMessage.run(roomId, userId, text.trim());
    const message = await queries.getMessageById.get(msgId);

    socket.to(`room:${roomId}`).emit("message:new", { roomId, message });
    socket.emit("message:ack", { tempId, message, roomId });
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

  socket.on("typing:start", async ({ roomId }) => {
    if (!(await queries.isMember.get(roomId, userId))) return;
    socket.to(`room:${roomId}`).emit("typing:update", { roomId, userId, username, typing: true });
  });

  socket.on("typing:stop", ({ roomId }) => {
    socket.to(`room:${roomId}`).emit("typing:update", { roomId, userId, username, typing: false });
  });

  socket.on("disconnect", async () => {
    markOffline(userId, socket.id);
    await queries.touchUser.run(userId);
    if (!isOnline(userId)) {
      socket.broadcast.emit("user:status", { userId, online: false });
    }
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

async function start() {
  await initDb();
  httpServer.listen(PORT, () => console.log(`Chatloop server → http://localhost:${PORT}`));
}

start();
