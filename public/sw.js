// Service worker: shows push notifications. It does not cache anything yet (offline use is a later step).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "Little Wins", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      // iOS requires every push to show a notification, so show it first.
      await self.registration.showNotification(data.title || "Little Wins", {
        body: data.body || "",
        tag: data.tag || undefined,
        icon: "/icons/icon-192.png",
        data: { url: data.url || "/" },
      });
      // Then tell the server it arrived, so the app can show "last push received".
      if (data.logId) {
        try {
          await fetch("/api/ack-push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ logId: data.logId }),
          });
        } catch (_) {
          /* offline: the notification is still shown */
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
