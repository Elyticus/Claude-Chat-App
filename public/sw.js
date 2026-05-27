// Chatloop service worker — handles Web Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Chatloop", body: event.data.text() };
  }

  const { title, body, roomId, icon } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Chatloop", {
      body: body || "",
      icon: icon || "/favicon.svg",
      badge: "/favicon.svg",
      tag: `room-${roomId}`,        // collapses multiple msgs from same room
      renotify: true,
      data: { roomId },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const roomId = event.notification.data?.roomId;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        // If a tab is already open, focus it and post a message to open the room
        const existing = list.find((c) => c.url && new URL(c.url).pathname === "/");
        if (existing) {
          existing.focus();
          if (roomId) existing.postMessage({ type: "OPEN_ROOM", roomId });
          return;
        }
        // Otherwise open a new tab
        const url = roomId ? `/?room=${roomId}` : "/";
        clients.openWindow(url);
      }),
  );
});
