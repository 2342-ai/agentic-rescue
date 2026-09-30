// Runs the download page's local patch path (web/patch.js) against a real ISO:
// inspectIso finds the slot through the ISO9660 directory, patchedBlob builds the
// configured image from slices. The result is written to OUT for comparison.
//
//   node tests/web-patch.mjs ISO OUT
import { readFileSync, openAsBlob, createWriteStream } from "node:fs";
import { Writable } from "node:stream";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [iso, out] = process.argv.slice(2);
if (!iso || !out) { console.error("usage: node tests/web-patch.mjs ISO OUT"); process.exit(2); }

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = { window: {}, TextEncoder, TextDecoder, TransformStream, Blob, DataView, Uint8Array, Uint32Array, Math, JSON, Error, Object, String, Array, Promise };
vm.createContext(sandbox);
vm.runInContext(readFileSync(process.env.PATCH_JS || path.join(here, "../web/patch.js"), "utf8"), sandbox);
const R = sandbox.window.RescuePatch;

const file = await openAsBlob(iso);
const slot = await R.inspectIso(file);
console.log(JSON.stringify({ offset: slot.offset, length: slot.length, version: slot.version, current: slot.current }));

const cfg = { providers: { groq: { key: "gsk_webtest" } }, model: "groq/openai/gpt-oss-120b", keymap: "de", name: "Web Test" };
const blob = R.patchedBlob(file, slot, cfg);
if (blob.size !== file.size) throw new Error(`size changed: ${blob.size} != ${file.size}`);
await blob.stream().pipeTo(Writable.toWeb(createWriteStream(out)));

// A file without the ISO9660 signature must be rejected.
try { await R.inspectIso(new Blob([new Uint8Array(40000)])); throw new Error("accepted a non-ISO"); }
catch (e) { if (e.message !== "notiso") throw e; }
console.log("web patch ok");
