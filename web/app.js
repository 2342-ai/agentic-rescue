(function () {
  const C = window.RESCUE_CONFIG, P = window.PROVIDERS, T = window.I18N, R = window.RescuePatch;
  const $ = (id) => document.getElementById(id);
  const streamMode = Boolean(C.RELEASE_BASE);
  let lang = (localStorage.getItem("lang") || (navigator.language || "en").slice(0, 2)) === "de" ? "de" : "en";
  let provider = P[0], variant = C.VARIANTS[0].id, releases = {};
  let isoFile = null, slot = null;

  const t = (key, vars) => (T[lang][key] ?? T.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? "");
  const gb = (n) => (n / 1e9).toFixed(1) + " GB";
  const mb = (n) => (n / 1e6).toFixed(0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ------------------------------------------------------------------ config
  function config() {
    const cfg = {};
    const key = $("key").value.trim();
    if (key) cfg.providers = { [provider.id]: { key } };
    const model = $("model").value.trim() || (key ? provider.model : "");
    if (model) cfg.model = model;
    const ssid = $("wifi-ssid").value.trim();
    if (ssid) cfg.wifi = [$("wifi-psk").value ? { ssid, psk: $("wifi-psk").value } : { ssid }];
    const ssh = $("sshkey").value.split("\n").map((s) => s.trim()).filter(Boolean);
    if (ssh.length) cfg.ssh_authorized_keys = ssh;
    if ($("keymap").value !== "us") cfg.keymap = $("keymap").value;
    if ($("name").value.trim()) cfg.name = $("name").value.trim();
    return cfg;
  }
  const hasSettings = (cfg) => Object.keys(cfg).some((k) => k !== "model");

  // ------------------------------------------------------------------ render
  function render() {
    document.documentElement.lang = lang;
    $("lang").textContent = lang === "de" ? "EN" : "DE";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });

    $("providers").innerHTML = P.map((p) => `
      <button type="button" class="provider ${p.id === provider.id ? "active" : ""}" data-id="${p.id}">
        ${esc(p.label)}
        <span class="tags">${p.tags.map((tag) => `<span class="tag ${tag}">${esc(t("tag." + tag))}</span>`).join("")}</span>
      </button>`).join("");
    $("providers").querySelectorAll(".provider").forEach((b) => b.addEventListener("click", () => {
      provider = P.find((p) => p.id === b.dataset.id); render(); $("key").focus();
    }));
    $("key").placeholder = provider.placeholder;
    $("model").placeholder = provider.model;
    const link = `<a href="${provider.url}" target="_blank" rel="noopener">${esc(provider.url.replace(/^https:\/\//, ""))}</a>`;
    $("key-hint").innerHTML = t(provider.id === "2342ai" ? "hint.2342" : "hint.key", { url: link });

    const available = C.VARIANTS.filter((v) => releases[v.id]);
    if (available.length && !releases[variant]) variant = available[0].id;
    $("variants").hidden = available.length < 2;
    $("variants").innerHTML = C.VARIANTS.map((v) => {
      const rel = releases[v.id];
      return `<button type="button" class="variant ${v.id === variant ? "active" : ""}" data-id="${v.id}" ${rel ? "" : "disabled"}>${v.id}<small>${esc(t(v.i18n))} · ${rel ? gb(rel.size) : v.size}</small></button>`;
    }).join("");
    $("variants").querySelectorAll(".variant:not([disabled])").forEach((b) => b.addEventListener("click", () => { variant = b.dataset.id; render(); }));

    const rel = releases[variant];
    $("go-label").textContent = rel ? t("s2.golabel", { v: rel.version, size: gb(rel.size) }) : t("s2.go");
    $("hero-meta").textContent = rel ? t("hero.meta", { v: rel.version, size: gb(rel.size) }) : "x86_64 · UEFI + BIOS · MIT";
    $("version").textContent = rel ? `v${rel.version}` : "";

    $("step3").hidden = streamMode;
    const iso = rel ? rel.iso : "agentic-rescue.iso";
    const cfg = config();
    const args = [`nix run github:${C.GITHUB_REPO}#patch -- ${iso}`, `  --provider ${provider.id} --key "YOUR_KEY"`];
    if (cfg.wifi) args.push(`  --wifi "${cfg.wifi[0].ssid}" "WIFI_PASSWORD"`);
    if (cfg.keymap) args.push(`  --keymap ${cfg.keymap}`);
    args.push(`  -o ${iso.replace(/\.iso$/, "")}-configured.iso`);
    $("cli").textContent = args.join(" \\\n");

    $("step1").classList.toggle("done", Boolean(cfg.providers));
    renderFound();
  }

  function renderFound() {
    const box = $("found");
    if (!isoFile) { box.hidden = true; return; }
    box.hidden = false;
    if (!slot || slot.error) {
      box.classList.add("bad");
      $("found-text").textContent = t(slot && slot.error === "notiso" ? "s3.notiso" : "s3.noslot");
      $("save").hidden = true;
      return;
    }
    box.classList.remove("bad");
    const cfg = config();
    let text = t("s3.found", { v: slot.version || "" });
    const existing = Object.keys((slot.current && slot.current.providers) || {});
    if (existing.length) text += " " + t("s3.foundcfg", { what: existing.join(", ") });
    if (!hasSettings(cfg)) text += " " + t("s3.needkey");
    $("found-text").textContent = text;
    $("save").hidden = false;
    $("save").disabled = !hasSettings(cfg);
  }

  function status(msg, cls) {
    $("status").textContent = msg;
    $("status").className = cls || "";
    $("spinner").className = "spinner" + (cls ? " " + cls : "");
  }

  // ------------------------------------------------------------------ releases
  async function loadReleases() {
    if (streamMode) {
      for (const v of C.VARIANTS) {
        try {
          const r = await fetch(`${C.RELEASE_BASE}/release-${v.id}.json`, { cache: "no-store" });
          if (r.ok) releases[v.id] = await r.json();
        } catch (e) { /* not published yet */ }
      }
    } else if (C.GITHUB_REPO) {
      try {
        const r = await fetch(`https://api.github.com/repos/${C.GITHUB_REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
        if (r.ok) {
          const rel = await r.json();
          for (const v of C.VARIANTS) {
            const asset = (rel.assets || []).find((a) => /\.iso$/.test(a.name) && (v.id === "offline") === a.name.includes("offline"));
            if (asset) releases[v.id] = { github: true, version: rel.tag_name.replace(/^v/, ""), iso: asset.name, size: asset.size, downloadUrl: asset.browser_download_url };
          }
        }
      } catch (e) { /* offline */ }
    }
    render();
  }

  // ------------------------------------------------------------------ step 2
  async function download() {
    const rel = releases[variant];
    $("dlstate").hidden = false;
    $("bar").parentElement.classList.remove("indeterminate");
    $("bar").style.width = "0%";
    if (!rel) {
      status(t("st.norelease"), "err");
      return;
    }
    if (rel.github) {
      // A plain navigation to the asset: GitHub answers with Content-Disposition:
      // attachment, so the browser downloads it natively and stays on this page.
      const a = document.createElement("a");
      a.href = rel.downloadUrl;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      $("bar").parentElement.classList.add("indeterminate");
      status(t("st.github", { name: rel.iso, size: gb(rel.size) }));
      $("step2").classList.add("done");
      return;
    }
    const cfg = config();
    $("go").disabled = true;
    status(t("st.start"));
    try {
      const result = await R.downloadPatched({
        release: rel,
        isoUrl: `${C.RELEASE_BASE}/${rel.iso}`,
        config: hasSettings(cfg) ? cfg : null,
        filename: hasSettings(cfg) ? rel.iso.replace(/\.iso$/, "-configured.iso") : rel.iso,
        onProgress: (done) => {
          $("bar").style.width = (100 * done / rel.size).toFixed(1) + "%";
          status(t("st.progress", { done: mb(done), total: mb(rel.size) }));
        },
      });
      if (result.verified) { status(t("st.verified", { sha: result.sha256.slice(0, 12) + "…" }), "ok"); $("step2").classList.add("done"); }
      else status(t("st.unverified"), "err");
    } catch (e) {
      if (e && e.name === "AbortError") { $("dlstate").hidden = true; }
      else status(e && e.message === "nostream" ? t("st.nostream") : t("st.err", { msg: e.message || e }), "err");
    } finally {
      $("go").disabled = false;
    }
  }

  // ------------------------------------------------------------------ step 3
  async function pick(file) {
    isoFile = file;
    slot = null;
    $("save-status").textContent = "";
    $("save-bar-wrap").hidden = true;
    $("drop-label").textContent = `${file.name} · ${gb(file.size)}`;
    try {
      slot = await R.inspectIso(file);
      $("bar").parentElement.classList.remove("indeterminate");
      $("bar").style.width = "100%";
    } catch (e) {
      slot = { error: e.message };
    }
    renderFound();
  }

  async function save() {
    const cfg = config();
    if (!isoFile || !slot || slot.error || !hasSettings(cfg)) return;
    const name = isoFile.name.replace(/(-configured)?\.iso$/i, "") + "-configured.iso";
    const blob = R.patchedBlob(isoFile, slot, cfg);
    $("save").disabled = true;
    $("save-bar-wrap").hidden = false;
    $("save-bar").style.width = "0%";
    try {
      const how = await R.saveBlob(blob, name, (done) => {
        $("save-bar").style.width = (100 * done / blob.size).toFixed(1) + "%";
        $("save-status").textContent = t("s3.saving", { done: mb(done), total: mb(blob.size) });
      });
      $("save-status").textContent = t(how === "fs" ? "s3.saved" : "s3.savedblob", { name });
      $("step3").classList.add("done");
    } catch (e) {
      $("save-bar-wrap").hidden = true;
      $("save-status").textContent = e && e.name === "AbortError" ? "" : t("st.err", { msg: e.message || e });
    } finally {
      $("save").disabled = false;
    }
  }

  // ------------------------------------------------------------------ wiring
  $("lang").addEventListener("click", () => { lang = lang === "de" ? "en" : "de"; localStorage.setItem("lang", lang); render(); if (isoFile && slot && !slot.error) renderFound(); });
  $("go").addEventListener("click", download);
  $("save").addEventListener("click", save);
  $("eye").addEventListener("click", () => { $("key").type = $("key").type === "password" ? "text" : "password"; });
  ["key", "model", "wifi-ssid", "wifi-psk", "sshkey", "keymap", "name"].forEach((id) => $(id).addEventListener("input", render));
  $("isofile").addEventListener("change", (e) => { if (e.target.files[0]) pick(e.target.files[0]); });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pick(f); });
  // Dropping a file anywhere else must not navigate away from the page.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  render();
  loadReleases();
})();
