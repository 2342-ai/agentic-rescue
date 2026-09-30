// Deployment settings for the download page.
//
// GITHUB_REPO: releases are listed through the GitHub API (which allows CORS).
//   ISO downloads come from the release assets. Release assets do not send CORS
//   headers, so in this mode the browser cannot patch the image; the page hands
//   out the ISO plus a rescue-config.json and the one-line patch command.
//
// RELEASE_BASE: optional host serving release-<variant>.json and the ISOs with
//   Access-Control-Allow-Origin for this page. When set, the page streams the
//   image and patches the configuration slot in the browser.
window.RESCUE_CONFIG = {
  GITHUB_REPO: "2342-ai/agentic-rescue",
  RELEASE_BASE: null,
  VARIANTS: [
    { id: "online", size: "~2.1 GB", i18n: "variant.online" },
    { id: "offline", size: "~4.5 GB", i18n: "variant.offline" },
  ],
};
