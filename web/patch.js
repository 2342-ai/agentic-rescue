// Stream an ISO from RELEASE_BASE, replace the configuration slot in place and
// deliver the result to disk. Verifies the SHA-256 of the *original* bytes
// while they pass through, so the page can say "verified" even though the
// patched file has a different checksum.
//
// Delivery: File System Access API (Chrome/Edge) when available, otherwise a
// service worker that turns a ReadableStream into a download (Firefox, Safari).
(function () {
  const SLOT_MAGIC = '"slot":"agentic-rescue-config-v1"';

  function encodeSlot(config, length) {
    const cfg = Object.assign({}, config, { v: 1, slot: "agentic-rescue-config-v1" });
    const bytes = new TextEncoder().encode(JSON.stringify(cfg));
    if (bytes.length > length) throw new Error(`configuration is ${bytes.length} bytes, the slot holds ${length}`);
    const out = new Uint8Array(length).fill(0x20);
    out.set(bytes);
    return out;
  }

  // Replaces bytes [offset, offset+payload.length) as chunks stream by.
  function patchTransform(offset, payload) {
    let pos = 0;
    return new TransformStream({
      transform(chunk, controller) {
        const chunkStart = pos, chunkEnd = pos + chunk.length;
        const slotStart = offset, slotEnd = offset + payload.length;
        if (chunkEnd > slotStart && chunkStart < slotEnd) {
          const copy = new Uint8Array(chunk);
          const from = Math.max(chunkStart, slotStart), to = Math.min(chunkEnd, slotEnd);
          copy.set(payload.subarray(from - slotStart, to - slotStart), from - chunkStart);
          chunk = copy;
        }
        pos = chunkEnd;
        controller.enqueue(chunk);
      },
    });
  }

  // Incremental SHA-256 of the untouched stream. WebCrypto has no streaming
  // digest, so this is a compact JS implementation; ~200 MB/s is plenty.
  class Sha256 {
    constructor() {
      this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
      this.buf = new Uint8Array(64); this.bufLen = 0; this.total = 0;
      this.w = new Uint32Array(64);
    }
    static K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    block(b, off) {
      const w = this.w, K = Sha256.K;
      for (let i = 0; i < 16; i++) w[i] = (b[off + i*4] << 24) | (b[off + i*4+1] << 16) | (b[off + i*4+2] << 8) | b[off + i*4+3];
      for (let i = 16; i < 64; i++) {
        const s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
        const s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let [a, b2, c, d, e, f, g, h] = this.h;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b2) ^ (a & c) ^ (b2 & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
      }
      const H = this.h;
      H[0] += a; H[1] += b2; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    update(data) {
      this.total += data.length;
      let i = 0;
      if (this.bufLen) {
        const take = Math.min(64 - this.bufLen, data.length);
        this.buf.set(data.subarray(0, take), this.bufLen);
        this.bufLen += take; i = take;
        if (this.bufLen === 64) { this.block(this.buf, 0); this.bufLen = 0; }
      }
      for (; i + 64 <= data.length; i += 64) this.block(data, i);
      if (i < data.length) { this.buf.set(data.subarray(i)); this.bufLen = data.length - i; }
    }
    hex() {
      const bits = this.total * 8;
      const pad = new Uint8Array(((this.bufLen + 8) >> 6 << 6) + 64 - this.bufLen);
      pad[0] = 0x80;
      const dv = new DataView(pad.buffer);
      dv.setUint32(pad.length - 8, Math.floor(bits / 0x100000000));
      dv.setUint32(pad.length - 4, bits >>> 0);
      this.update(pad);
      return Array.from(this.h, x => (x >>> 0).toString(16).padStart(8, "0")).join("");
    }
  }

  function hashTap(sha) {
    return new TransformStream({
      transform(chunk, controller) { sha.update(chunk); controller.enqueue(chunk); },
    });
  }

  function progressTap(onProgress) {
    let done = 0;
    return new TransformStream({
      transform(chunk, controller) { done += chunk.length; onProgress(done); controller.enqueue(chunk); },
    });
  }

  async function openSink(filename, size) {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "Disc image", accept: { "application/x-iso9660-image": [".iso"] } }] });
      return { stream: await handle.createWritable(), kind: "fs" };
    }
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.register("sw.js");
      await navigator.serviceWorker.ready;
      const id = Math.random().toString(36).slice(2);
      const channel = new MessageChannel();
      const { readable, writable } = new TransformStream();
      const worker = reg.active || (await navigator.serviceWorker.ready).active;
      worker.postMessage({ id, filename, size, readable }, [readable]);
      // Trigger the download; the worker answers the fetch with our stream.
      const iframe = document.createElement("iframe");
      iframe.hidden = true;
      iframe.src = `sw-download/${id}/${encodeURIComponent(filename)}`;
      document.body.appendChild(iframe);
      return { stream: writable, kind: "sw" };
    }
    throw new Error("nostream");
  }

  async function downloadPatched({ release, isoUrl, config, filename, onProgress }) {
    const sha = new Sha256();
    const payload = config ? encodeSlot(config, release.configLength) : null;
    const sink = await openSink(filename, release.size);
    const response = await fetch(isoUrl);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    let stream = response.body.pipeThrough(hashTap(sha)).pipeThrough(progressTap(onProgress));
    if (payload) stream = stream.pipeThrough(patchTransform(release.configOffset, payload));
    await stream.pipeTo(sink.stream);
    const hex = sha.hex();
    return { verified: hex === release.sha256, sha256: hex };
  }

  // ---------------------------------------------------------------- local ISO
  // For images downloaded without CORS (GitHub Releases): the person picks the
  // downloaded file, the page finds the slot through the ISO9660 directory and
  // writes a new file made of two untouched slices of the original plus the
  // 16 KiB payload. Blob slices are lazy, so nothing is loaded into memory.

  const SECTOR = 2048;

  async function bytes(file, start, end) {
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
  }

  function ascii(u8) {
    let out = "";
    for (const b of u8) out += String.fromCharCode(b);
    return out;
  }

  async function readDirectory(file, lba, size) {
    const dir = await bytes(file, lba * SECTOR, lba * SECTOR + size);
    const entries = [];
    let i = 0;
    while (i < dir.length) {
      const len = dir[i];
      if (len === 0) { i = (Math.floor(i / SECTOR) + 1) * SECTOR; continue; }
      const dv = new DataView(dir.buffer, dir.byteOffset + i, len);
      const nameLen = dir[i + 32];
      entries.push({
        lba: dv.getUint32(2, true),
        size: dv.getUint32(10, true),
        dir: (dir[i + 25] & 2) !== 0,
        name: ascii(dir.subarray(i + 33, i + 33 + nameLen)).replace(/;\d+$/, "").toUpperCase(),
      });
      i += len;
    }
    return entries;
  }

  // Returns { offset, length, current, version } or throws Error("notiso" | "noslot").
  async function inspectIso(file) {
    const pvd = await bytes(file, 16 * SECTOR, 17 * SECTOR);
    if (pvd[0] !== 1 || ascii(pvd.subarray(1, 6)) !== "CD001") throw new Error("notiso");
    const dv = new DataView(pvd.buffer, pvd.byteOffset);
    const entries = await readDirectory(file, dv.getUint32(156 + 2, true), dv.getUint32(156 + 10, true));
    const entry = entries.find((e) => !e.dir && e.name === "RESCUE_CONFIG.JSON");
    if (!entry) throw new Error("noslot");
    const offset = entry.lba * SECTOR;
    const raw = await bytes(file, offset, offset + entry.size);
    let current;
    try {
      current = JSON.parse(new TextDecoder().decode(raw).replace(/[\s\0]+$/, ""));
    } catch (e) {
      throw new Error("noslot");
    }
    if (!current || current.slot !== "agentic-rescue-config-v1") throw new Error("noslot");
    let version = null;
    const ver = entries.find((e) => !e.dir && e.name === "VERSION.TXT");
    if (ver && ver.size < 256) version = new TextDecoder().decode(await bytes(file, ver.lba * SECTOR, ver.lba * SECTOR + ver.size)).trim();
    return { offset, length: entry.size, current, version };
  }

  function patchedBlob(file, slot, config) {
    const payload = encodeSlot(config, slot.length);
    return new Blob([file.slice(0, slot.offset), payload, file.slice(slot.offset + slot.length)], { type: "application/octet-stream" });
  }

  // Must be called from a click handler: the save dialog needs user activation.
  async function saveBlob(blob, filename, onProgress) {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "Disc image", accept: { "application/x-iso9660-image": [".iso"] } }] });
      const writable = await handle.createWritable();
      await blob.stream().pipeThrough(progressTap(onProgress)).pipeTo(writable);
      return "fs";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    onProgress(blob.size);
    return "blob";
  }

  window.RescuePatch = { downloadPatched, encodeSlot, Sha256, SLOT_MAGIC, inspectIso, patchedBlob, saveBlob };
})();
