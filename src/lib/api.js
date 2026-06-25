const BASE = import.meta.env.VITE_API_URL || "/api";

function token() {
  return localStorage.getItem("linkloop_token");
}

function authHeaders() {
  const t = token();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

// Multipart upload — must NOT set Content-Type (the browser adds the multipart
// boundary). Preserves the server's gate codes like request() does.
async function upload(path, formData) {
  const t = token();
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Upload failed");
    if (data.code) err.code = data.code;
    if (data.plan) err.plan = data.plan;
    throw err;
  }
  return data;
}

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    // Preserve the server's machine-readable gate codes (UPGRADE_REQUIRED /
    // QUOTA_EXCEEDED / AI_UNAVAILABLE) so callers can route to the upgrade flow.
    const err = new Error(data.error || "Request failed");
    if (data.code) err.code = data.code;
    if (data.plan) err.plan = data.plan;
    throw err;
  }
  return data;
}

export const api = {
  register: (username, email, password) =>
    request("POST", "/auth/register", { username, email, password }),

  verifyEmail: (email, code) =>
    request("POST", "/auth/verify", { email, code }),

  resendCode: (email) =>
    request("POST", "/auth/resend", { email }),

  login: (email, password) =>
    request("POST", "/auth/login", { email, password }),

  forgotPassword: (email) =>
    request("POST", "/auth/forgot-password", { email }),

  resetPassword: (email, code, password) =>
    request("POST", "/auth/reset-password", { email, code, password }),

  getUsers: () => request("GET", "/users"),

  getRooms: () => request("GET", "/rooms"),

  getMessages: (roomId, before) => {
    const qs = before ? `?before=${before}` : "";
    return request("GET", `/rooms/${roomId}/messages${qs}`);
  },

  createDM: (targetUserId) =>
    request("POST", "/rooms/dm", { targetUserId }),

  createGroup: (userIds, name) =>
    request("POST", "/rooms/group", { userIds, name }),

  addGroupMember: (roomId, userId) =>
    request("POST", `/rooms/${roomId}/members`, { userId }),

  getSharedRooms: (userId) => request("GET", `/users/${userId}/shared-rooms`),

  deleteMessage: (messageId) => request("DELETE", `/messages/${messageId}`),

  deleteRoom: (roomId) => request("DELETE", `/rooms/${roomId}`),

  sendContactRequest: (contactId) =>
    request("POST", "/contacts/request", { contactId }),

  acceptContact: (requesterId) =>
    request("POST", "/contacts/accept", { requesterId }),

  removeContact: (contactId) => request("DELETE", `/contacts/${contactId}`),

  uploadAvatar: (avatar) => request("POST", "/users/me/avatar", { avatar }),

  getRoomMembers: (roomId) => request("GET", `/rooms/${roomId}/members`),

  createChannel: (name, slug, description, isPrivate) =>
    request("POST", "/channels", { name, slug, description, isPrivate }),

  joinChannel: (slug) =>
    request("POST", "/channels/join", { slug }),

  lookupChannel: (slug) =>
    request("GET", `/channels/lookup/${encodeURIComponent(slug.replace(/^#/, ""))}`),

  setMemberRole: (roomId, userId, role) =>
    request("PATCH", `/channels/${roomId}/members/${userId}/role`, { role }),

  kickChannelMember: (roomId, userId) =>
    request("DELETE", `/channels/${roomId}/members/${userId}`),

  addChannelMember: (roomId, userId) =>
    request("POST", `/channels/${roomId}/members`, { userId }),

  editChannel: (roomId, name, description, slug) =>
    request("PATCH", `/channels/${roomId}`, { name, description, ...(slug !== undefined && { slug }) }),

  muteChannelMember: (roomId, userId, duration) =>
    request("PATCH", `/channels/${roomId}/members/${userId}/mute`, { duration }),

  pinMessage: (roomId, messageId) =>
    request("POST", `/channels/${roomId}/pins`, { messageId }),

  unpinMessage: (roomId, messageId) =>
    request("DELETE", `/channels/${roomId}/pins/${messageId}`),

  getPinnedMessages: (roomId) =>
    request("GET", `/channels/${roomId}/pins`),

  pushSubscribe: (sub) => {
    const json = sub.toJSON();
    return request("POST", "/push/subscribe", {
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
  },

  pushUnsubscribe: (endpoint) =>
    request("DELETE", "/push/unsubscribe", { endpoint }),

  // ── Billing & plans ────────────────────────────────────────────────────────
  getMe: () => request("GET", "/me"),
  getPlans: () => request("GET", "/billing/plans"),
  startCheckout: (plan) => request("POST", "/billing/checkout", { plan }),
  confirmCheckout: (checkoutId, plan) =>
    request("POST", "/billing/confirm", { checkoutId, plan }),
  cancelPlan: () => request("POST", "/billing/cancel"),
  resumePlan: () => request("POST", "/billing/resume"),

  // ── AI (Claude) ─────────────────────────────────────────────────────────────
  aiSummarize: (roomId) => request("POST", "/ai/summarize", { roomId }),
  aiReplies: (roomId) => request("POST", "/ai/replies", { roomId }),
  aiAsk: (roomId, question) => request("POST", "/ai/ask", { roomId, question }),
  aiTranslate: (messageId, targetLang) =>
    request("POST", "/ai/translate", { messageId, targetLang }),
  aiBackground: (prompt) => request("POST", "/ai/background", { prompt }),

  // ── Global search ───────────────────────────────────────────────────────────
  searchMessages: (q) => request("GET", `/search?q=${encodeURIComponent(q)}`),

  // ── Attachments (media & voice) ──────────────────────────────────────────────
  uploadAttachment: (roomId, file, { caption, kind, duration, width, height, socketId } = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    if (caption) fd.append("caption", caption);
    if (kind) fd.append("kind", kind);
    if (duration != null) fd.append("duration", String(duration));
    if (width != null) fd.append("width", String(width));
    if (height != null) fd.append("height", String(height));
    if (socketId) fd.append("socketId", socketId);
    return upload(`/rooms/${roomId}/attachments`, fd);
  },
  // Token in the query so <img>/<audio> elements can load private files.
  attachmentUrl: (id) => `${BASE}/attachments/${id}?token=${encodeURIComponent(token() || "")}`,
};
