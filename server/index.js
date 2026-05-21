import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import "dotenv/config";

import { db, queries } from "./db.js";
import { generateToken, verifyToken } from "./auth.js";

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = // eslint-disable-next-line no-undef
  (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
// eslint-disable-next-line no-undef
const PORT = Number(process.env.PORT) || 4000;

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ─── Presence ──────────────────────────────────────────────────────────────────
// userId → Set<socketId>
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

// ─── REST: Auth ────────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!username?.trim() || !email?.trim() || !password) {
    return res
      .status(400)
      .json({ error: "username, email, and password are required" });
  }

  const taken =
    queries.getUserByEmail.get(email) ||
    queries.getUserByUsername.get(username);
  if (taken)
    return res.status(409).json({ error: "Username or email already in use" });

  const hash = await bcrypt.hash(password, 10);
  const { lastInsertRowid: id } = queries.createUser.run(
    username.trim(),
    email.trim(),
    hash,
  );

  const user = { id, username: username.trim(), email: email.trim() };
  res.status(201).json({ token: generateToken(user), user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const row = queries.getUserByEmail.get(email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, username: row.username, email: row.email };
  res.json({ token: generateToken(user), user });
});

// ─── REST: Users ───────────────────────────────────────────────────────────────

app.get("/api/users", requireAuth, (req, res) => {
  const rows = queries.getAllUsersExcept.all(req.user.id);
  res.json(rows.map((u) => ({ ...u, online: isOnline(u.id) })));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Join all online members' sockets to the new room and tell them to refresh.
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

app.get("/api/rooms", requireAuth, (req, res) => {
  const rows = queries.getUserRooms.all(req.user.id, req.user.id);
  res.json(
    rows.map((r) => ({
      ...r,
      other_user_online: r.other_user_id ? isOnline(r.other_user_id) : false,
    })),
  );
});

app.post("/api/rooms/dm", requireAuth, (req, res) => {
  const { targetUserId } = req.body ?? {};
  if (!targetUserId)
    return res.status(400).json({ error: "targetUserId required" });

  const target = queries.getUserById.get(targetUserId);
  if (!target) return res.status(404).json({ error: "User not found" });

  const existing = queries.findDmRoom.get(req.user.id, targetUserId);
  if (existing) return res.json({ roomId: existing.id });

  const { lastInsertRowid: roomId } = queries.createRoom.run(0, null);
  queries.addMember.run(roomId, req.user.id);
  queries.addMember.run(roomId, targetUserId);

  notifyNewRoom(roomId, [req.user.id, targetUserId]);

  res.status(201).json({ roomId });
});

app.post("/api/rooms/group", requireAuth, (req, res) => {
  const { userIds, name } = req.body ?? {};
  if (!Array.isArray(userIds) || userIds.length < 1) {
    return res.status(400).json({ error: "At least 1 other member required" });
  }
  if (!name?.trim()) {
    return res.status(400).json({ error: "Group name required" });
  }

  const { lastInsertRowid: roomId } = queries.createRoom.run(1, name.trim());
  const allMembers = [req.user.id, ...userIds];
  allMembers.forEach((uid) => queries.addMember.run(roomId, uid));

  notifyNewRoom(roomId, allMembers);

  res.status(201).json({ roomId });
});

app.get("/api/rooms/:roomId/messages", requireAuth, (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!queries.isMember.get(roomId, req.user.id)) {
    return res.status(403).json({ error: "Not a member of this room" });
  }
  res.json(queries.getRoomMessages.all(roomId));
});

app.delete("/api/rooms/:roomId", requireAuth, (req, res) => {
  const roomId = Number(req.params.roomId);
  if (!queries.isMember.get(roomId, req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  queries.removeMember.run(roomId, req.user.id);
  const { cnt } = queries.memberCount.get(roomId);
  if (cnt === 0) queries.deleteRoom.run(roomId);
  res.json({ ok: true });
});

app.delete("/api/messages/:messageId", requireAuth, (req, res) => {
  const messageId = Number(req.params.messageId);
  const msg = queries.getMessageById.get(messageId);
  if (!msg) return res.status(404).json({ error: "Not found" });
  if (!queries.isMember.get(msg.room_id, req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  queries.deleteMessage.run(messageId, req.user.id);
  io.to(`room:${msg.room_id}`).emit("message:deleted", {
    roomId: msg.room_id,
    messageId,
  });
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

io.on("connection", (socket) => {
  const { id: userId, username } = socket.user;

  markOnline(userId, socket.id);
  queries.touchUser.run(userId);

  // Join all rooms this user belongs to
  const userRooms = db
    .prepare("SELECT room_id FROM room_members WHERE user_id = ?")
    .all(userId);
  userRooms.forEach(({ room_id }) => socket.join(`room:${room_id}`));

  // Notify others this user came online
  socket.broadcast.emit("user:status", { userId, online: true });

  // ── message:send ─────────────────────────────────────────────────────────────
  socket.on("message:send", ({ roomId, text, tempId }) => {
    if (!text?.trim() || !roomId) return;
    if (!queries.isMember.get(roomId, userId)) return;

    const { lastInsertRowid: msgId } = queries.insertMessage.run(
      roomId,
      userId,
      text.trim(),
    );
    const message = queries.getMessageById.get(msgId);

    // Broadcast to everyone else in the room
    socket.to(`room:${roomId}`).emit("message:new", { roomId, message });

    // Acknowledge to sender (replace optimistic message)
    socket.emit("message:ack", { tempId, message, roomId });
  });

  // ── message:react ─────────────────────────────────────────────────────────────
  socket.on("message:react", ({ messageId, emoji }) => {
    const msg = queries.getMessageById.get(messageId);
    if (!msg || !queries.isMember.get(msg.room_id, userId)) return;

    // Toggle: same emoji removes reaction
    const newReaction = msg.reaction === emoji ? null : emoji;
    queries.setReaction.run(newReaction, messageId);

    io.to(`room:${msg.room_id}`).emit("message:reaction", {
      roomId: msg.room_id,
      messageId,
      emoji: newReaction,
    });
  });

  // ── typing ───────────────────────────────────────────────────────────────────
  socket.on("typing:start", ({ roomId }) => {
    if (!queries.isMember.get(roomId, userId)) return;
    socket
      .to(`room:${roomId}`)
      .emit("typing:update", { roomId, userId, username, typing: true });
  });

  socket.on("typing:stop", ({ roomId }) => {
    socket
      .to(`room:${roomId}`)
      .emit("typing:update", { roomId, userId, username, typing: false });
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    markOffline(userId, socket.id);
    queries.touchUser.run(userId);
    if (!isOnline(userId)) {
      socket.broadcast.emit("user:status", { userId, online: false });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Chatloop server → http://localhost:${PORT}`);
});
