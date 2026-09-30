// Deployment settings for the download page.
// RELEASE_BASE must serve release-<variant>.json and the ISO files with CORS
// headers (Access-Control-Allow-Origin) because the browser streams them.
window.RESCUE_CONFIG = {
  RELEASE_BASE: "https://dl.rescue.anycast.io",
  VARIANTS: [
    { id: "online", size: "~1.6 GB", i18n: "variant.online" },
    { id: "offline", size: "~4.2 GB", i18n: "variant.offline" },
  ],
};
