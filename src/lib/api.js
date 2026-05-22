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

  getUsers: () => request("GET", "/users"),

  getRooms: () => request("GET", "/rooms"),

  getMessages: (roomId) => request("GET", `/rooms/${roomId}/messages`),

  createDM: (targetUserId) =>
    request("POST", "/rooms/dm", { targetUserId }),

  createGroup: (userIds, name) =>
    request("POST", "/rooms/group", { userIds, name }),

  deleteMessage: (messageId) => request("DELETE", `/messages/${messageId}`),

  deleteRoom: (roomId) => request("DELETE", `/rooms/${roomId}`),
};
