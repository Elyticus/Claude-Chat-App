const BASE = import.meta.env.VITE_API_URL || "/api";

function token() {
  return localStorage.getItem("chatloop_token");
}

function authHeaders() {
  const t = token();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
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

  editChannel: (roomId, name, description) =>
    request("PATCH", `/channels/${roomId}`, { name, description }),

  muteChannelMember: (roomId, userId, duration) =>
    request("PATCH", `/channels/${roomId}/members/${userId}/mute`, { duration }),

  pinMessage: (roomId, messageId) =>
    request("POST", `/channels/${roomId}/pins`, { messageId }),

  unpinMessage: (roomId, messageId) =>
    request("DELETE", `/channels/${roomId}/pins/${messageId}`),

  getPinnedMessages: (roomId) =>
    request("GET", `/channels/${roomId}/pins`),
};
