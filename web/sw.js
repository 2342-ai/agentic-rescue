// Service worker that turns a ReadableStream posted by the page into a file
// download, for browsers without the File System Access API.
const pending = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const { id, filename, size, readable } = event.data || {};
  if (id && readable) pending.set(id, { filename, size, readable });
});

self.addEventListener("fetch", (event) => {
  const m = event.request.url.match(/\/sw-download\/([a-z0-9]+)\//);
  if (!m) return;
  const entry = pending.get(m[1]);
  if (!entry) return event.respondWith(new Response("expired", { status: 410 }));
  pending.delete(m[1]);
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${entry.filename.replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  });
  if (entry.size) headers.set("Content-Length", String(entry.size));
  event.respondWith(new Response(entry.readable, { headers }));
});
