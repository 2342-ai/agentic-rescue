(function () {
  const C = window.RESCUE_CONFIG, P = window.PROVIDERS, T = window.I18N;
  const $ = (id) => document.getElementById(id);
  let lang = (localStorage.getItem("lang") || (navigator.language || "en").slice(0, 2)) === "de" ? "de" : "en";
  let provider = P[0], variant = C.VARIANTS[0].id, releases = {};

  const t = (key, vars) => (T[lang][key] || T.en[key] || key).replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? "");

  function render() {
    document.documentElement.lang = lang;
    $("lang").textContent = lang === "de" ? "EN" : "DE";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $("providers").innerHTML = P.map((p) => `
      <button type="button" class="provider ${p.id === provider.id ? "active" : ""}" data-id="${p.id}">
        <span class="name">${p.label}</span>
        ${p.tags.map((tag) => `<span class="tag ${tag}">${t("tag." + tag)}</span>`).join(" ")}
      </button>`).join("");
    $("providers").querySelectorAll(".provider").forEach((b) => b.addEventListener("click", () => { provider = P.find((p) => p.id === b.dataset.id); render(); }));
    $("key").placeholder = provider.placeholder;
    $("model").placeholder = provider.model;
    const link = `<a href="${provider.url}" target="_blank" rel="noopener">${provider.url.replace(/^https:\/\//, "")}</a>`;
    $("key-hint").innerHTML = t(provider.id === "2342ai" ? "hint.2342" : "hint.key", { url: link });
    $("variants").innerHTML = C.VARIANTS.map((v) => {
      const rel = releases[v.id];
      const size = rel ? (rel.size / 1e9).toFixed(1) + " GB" : v.size;
      return `<button type="button" class="variant ${v.id === variant ? "active" : ""}" data-id="${v.id}">${v.id}<small>${t(v.i18n)} · ${size}</small></button>`;
    }).join("");
    $("variants").querySelectorAll(".variant").forEach((b) => b.addEventListener("click", () => { variant = b.dataset.id; render(); }));
    const rel = releases[variant];
    $("version").textContent = rel ? `v${rel.version}` : "";
  }

  async function loadReleases() {
    for (const v of C.VARIANTS) {
      try {
        const r = await fetch(`${C.RELEASE_BASE}/release-${v.id}.json`, { cache: "no-store" });
        if (r.ok) releases[v.id] = await r.json();
      } catch (e) { /* offline page or not published yet */ }
    }
    render();
  }

  function config() {
    const key = $("key").value.trim();
    const cfg = {};
    if (key) cfg.providers = { [provider.id]: { key } };
    const model = $("model").value.trim();
    cfg.model = model || (key ? provider.model : undefined);
    if (!cfg.model) delete cfg.model;
    const ssid = $("wifi-ssid").value.trim();
    if (ssid) cfg.wifi = [{ ssid, psk: $("wifi-psk").value }];
    const ssh = $("sshkey").value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (ssh.length) cfg.ssh_authorized_keys = ssh;
    if ($("keymap").value !== "us") cfg.keymap = $("keymap").value;
    if ($("name").value.trim()) cfg.name = $("name").value.trim();
    return cfg;
  }

  function status(msg, cls) { $("status").textContent = msg; $("status").className = cls || ""; }

  async function go(withConfig) {
    const cfg = withConfig ? config() : null;
    if (withConfig && !cfg.providers) return status(t("st.nokey"), "err");
    const rel = releases[variant];
    if (!rel) return status(t("st.err", { msg: "release not published" }), "err");
    $("go").disabled = true; $("plain").disabled = true;
    $("progress").hidden = false; $("bar").style.width = "0%";
    status(t("st.start"));
    const total = (rel.size / 1e6).toFixed(0);
    try {
      const result = await window.RescuePatch.downloadPatched({
        release: rel,
        isoUrl: `${C.RELEASE_BASE}/${rel.iso}`,
        config: cfg,
        filename: cfg ? rel.iso.replace(/\.iso$/, "-configured.iso") : rel.iso,
        onProgress: (done) => {
          $("bar").style.width = (100 * done / rel.size).toFixed(1) + "%";
          status(t("st.progress", { done: (done / 1e6).toFixed(0), total }));
        },
      });
      if (result.verified) status(t("st.verified", { sha: result.sha256.slice(0, 12) + "…" }) + (cfg ? "" : " " + t("st.plain")), "ok");
      else status(t("st.unverified"), "err");
    } catch (e) {
      if (e && e.name === "AbortError") status("");
      else status(e && e.message === "nostream" ? t("st.nostream") : t("st.err", { msg: e.message || e }), "err");
    } finally {
      $("go").disabled = false; $("plain").disabled = false;
    }
  }

  $("lang").addEventListener("click", () => { lang = lang === "de" ? "en" : "de"; localStorage.setItem("lang", lang); render(); });
  $("go").addEventListener("click", () => go(true));
  $("plain").addEventListener("click", () => go(false));
  render();
  loadReleases();
})();
