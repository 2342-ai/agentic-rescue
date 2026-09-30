<p align="center">
  <img src="web/favicon.svg" width="72" alt="">
</p>

<h1 align="center">Agentic Rescue</h1>

<p align="center">
  A NixOS live rescue system with <b>opencode</b>, <b>Claude Code</b> and <b>Codex</b> built in.<br>
  One key, three agents, no login at boot. Configured in your browser while the ISO downloads.
</p>

<p align="center">
  <a href="README.de.md">Deutsch</a> ·
  <a href="https://rescue.2342.ai">Download</a> ·
  <a href="#build-it-yourself">Build it yourself</a> ·
  <a href="#the-configuration-slot">Configuration slot</a> ·
  <a href="https://2342.ai">2342.ai</a> ·
  <a href="https://anycast.io">anycast.io</a>
</p>

---

Your laptop will not boot. You plug in a stick, and thirty seconds later an agent that knows how LUKS, Btrfs, ZFS, systemd-boot and pacman fit together is reading `dmesg` and the installed system's journal with you. It mounts read-only first, tells you what it found, and asks before it changes anything.

That is what Agentic Rescue does. It is SystemRescue with a brain, built from a single Nix flake.

## What you get

- **A rescue console that looks good.** kmscon on tty1 with JetBrains Mono, truecolor and a Tokyo Night palette, tmux underneath, a `gum` menu on top. A second boot entry with `nomodeset` for difficult GPUs.
- **Three agents.** `opencode`, `claude` and `codex` are installed and preconfigured. They read `/etc/agentic-rescue/AGENTS.md`, which tells them where they are, how NixOS, Arch, Debian, Fedora and Windows installs look from the outside, and the rules: diagnose read-only first, never run anything destructive without showing the command and getting a yes, back up before editing.
- **One key for all three.** [2342.ai](https://2342.ai) speaks the OpenAI-compatible, Responses and Anthropic Messages APIs. A single key drives opencode, Codex and Claude Code, with a visible data path and one budget. Groq, Google AI Studio, OpenRouter and OpenCode Zen work too and have free tiers. Anthropic and OpenAI keys work directly.
- **Configured before it ever boots.** The ISO has a 16 KiB configuration slot. The [download page](https://rescue.2342.ai) writes your key, Wi-Fi, SSH key and keyboard layout into it *in the browser* while the image streams to your disk. No server sees the key, no image is rebuilt per user.
- **Or configured at the console.** No key in the slot? `C-Space k` shows a QR code. Your phone opens a one-time page on the local network and pastes the key in. Claude and Codex subscribers sign in the same way: `C-Space u` hands the sign-in link to the phone and takes the code back.
- **Real filesystem support.** ZFS, Btrfs, XFS, ext4, NTFS, exFAT, F2FS, LUKS, LVM, mdadm. `rescue-mount` finds the installed system, unlocks it, mounts it read-only at `/mnt` with the right subvolumes, and `rescue-enter` chroots in with `nixos-enter` or `arch-chroot`.
- **Works offline.** The `offline` variant ships a local 4B model (Qwen3-4B-Instruct, Q4) served by llama.cpp. Slow, but it reads logs and calls tools without any network.
- **Phone as second screen.** `rescue-share` serves the console over ttyd on the LAN; Tailscale is installed for when the LAN is not enough.
- **Reproducible.** `nix build .#iso` gives you the same image the download page serves, minus your key. Everything is a NixOS module you can import into your own ISO.

## Quick start

1. Go to [rescue.2342.ai](https://rescue.2342.ai), pick a provider, paste a key, download.
2. Write the file to a stick: `dd if=agentic-rescue-*.iso of=/dev/sdX bs=4M status=progress oflag=sync`, or use Etcher or Ventoy.
3. Boot it. You land in the menu. `rescue-mount`, then `opencode`.

Without the download page:

```sh
nix build github:2342-ai/agentic-rescue#iso
nix run github:2342-ai/agentic-rescue#patch -- result/iso/*.iso \
  --provider groq --key gsk_... --wifi "Home" "password" --keymap de -o my-rescue.iso
```

## On the console

```
  Agentic Rescue                 wifi: Home 192.168.1.20 │ 2342ai/claude-sonnet-4-5 │ /mnt -

  › Start agent
    Connect AI provider
    Wi-Fi
    Mount installed system (read-only)
    Enter installed system (chroot)
    Share console to phone
    Save keys on the stick (RESCUE_DATA)
    Hardware overview
    Shell
```

| Command | What it does |
|---|---|
| `rescue` | The menu. Also `C-Space m` in tmux. |
| `rescue-mount [--rw]` | Unlock LUKS, assemble LVM/mdadm, import ZFS, find the root, mount at `/mnt`. Read-only unless `--rw`. `--unmount` reverses it. |
| `rescue-enter [-- cmd]` | `nixos-enter` for NixOS roots, `arch-chroot` for everything else. |
| `rescue-connect` | Type a key, enter it from your phone, or start an agent's own sign-in. |
| `rescue-handoff link` | Send the last link on screen to your phone as a QR code; the phone can paste a code back. `C-Space u`. |
| `rescue-share` | The tmux session in a phone browser (ttyd, random token URL). `C-Space s`. |
| `rescue-persist` | Create a writable `RESCUE_DATA` partition behind the ISO on the stick. Keys saved there survive reboots. |
| `rescue-status` | Network, provider, model, mount state. Also the tmux status line. |
| `rescue-config show` | The merged configuration with secrets masked. |
| `impala` | Wi-Fi. `C-Space w`. |

tmux prefix is `C-Space`. `C-Space ?` lists the keys.

## The configuration slot

`/rescue-config.json` in the ISO root is a 16 KiB file: compact JSON followed by spaces. ISO9660 stores files contiguously, so the bytes can be replaced in place without touching anything else. The image stays the same size, the hybrid GPT stays valid, and the file survives dd, Etcher, Ventoy and Rufus alike. At boot it is `/iso/rescue-config.json`.

```json
{
  "v": 1,
  "slot": "agentic-rescue-config-v1",
  "providers": {
    "2342ai":     { "key": "..." },
    "groq":       { "key": "gsk_..." },
    "google":     { "key": "AIza..." },
    "openrouter": { "key": "sk-or-..." },
    "opencode":   { "key": "..." },
    "anthropic":  { "key": "sk-ant-..." },
    "openai":     { "key": "sk-..." }
  },
  "agent": "opencode",
  "model": "2342ai/claude-sonnet-4-5",
  "claude_model": "claude-sonnet-4-5",
  "codex_model": "gpt-5.3-codex",
  "wifi": [{ "ssid": "Home", "psk": "..." }, { "ssid": "Open Cafe" }],
  "ssh_authorized_keys": ["ssh-ed25519 AAAA... me"],
  "tailscale_authkey": "tskey-auth-...",
  "keymap": "de",
  "name": "Franz' rescue stick"
}
```

Every field is optional except `v` and `slot`. The `slot` marker is how the patch tools find the offset without a sidecar; keep it.

Three sources are merged at boot, later ones win: the ISO slot, `/persist/rescue-config.json` on a `RESCUE_DATA` partition, and values entered at runtime. `rescue-config apply` then writes:

| Target | From |
|---|---|
| `/run/agentic-rescue/env` | provider keys as `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI2342_API_KEY` |
| `~/.config/opencode/opencode.json` | model, custom providers (2342.ai, local llama.cpp), permission rules that make destructive commands ask |
| `~/.claude/settings.json` | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` for 2342.ai, or nothing when an Anthropic key is present; allow/ask lists |
| `~/.codex/config.toml` | `model_provider` on 2342.ai's Responses endpoint, or OpenAI directly; `sandbox_mode = "danger-full-access"` because repairs need the disks |
| `/var/lib/iwd/*.psk` | Wi-Fi networks |
| `~/.ssh/authorized_keys` | SSH keys |
| `/run/agentic-rescue/kmscon/kmscon.conf` | keyboard layout for the console |

Which agent uses which provider: Claude Code prefers an Anthropic key, then 2342.ai. Codex prefers an OpenAI key, then 2342.ai. opencode takes the `model` field, or the first configured provider's default.

### Patching an image

```sh
# From the flake (any OS with Nix):
nix run github:2342-ai/agentic-rescue#patch -- rescue.iso --provider groq --key gsk_... -o out.iso
nix run github:2342-ai/agentic-rescue#patch -- rescue.iso --config my-config.json          # in place
nix run github:2342-ai/agentic-rescue#patch -- rescue.iso --extract                        # read it back
nix run github:2342-ai/agentic-rescue#patch -- rescue.iso --locate                         # offset as JSON

# By hand, given release.json:
offset=$(jq .configOffset release.json)
python3 -c 'import json,sys; d=json.dumps(json.load(open(sys.argv[1])),separators=(",",":")).encode(); sys.stdout.buffer.write(d+b" "*(16384-len(d)))' my-config.json \
  | dd of=rescue.iso bs=1 seek="$offset" conv=notrunc
```

`release.json` is produced next to every ISO by `nix build .#release` and published by CI:

```json
{ "v": 1, "version": "0.1.0", "variant": "online", "iso": "agentic-rescue-0.1.0-x86_64-linux.iso",
  "size": 1650000000, "sha256": "…", "configOffset": 1234567, "configLength": 16384,
  "slotMagic": "\"slot\":\"agentic-rescue-config-v1\"" }
```

## The download page

`web/` is a static page without a framework. It fetches `release-<variant>.json`, streams the ISO through a `TransformStream` that swaps the slot bytes at the published offset, hashes the untouched bytes on the way through to verify the original against `sha256`, and writes the result via the File System Access API or a service worker download. The key exists in the browser tab and in the resulting file, nowhere else.

Two hosting modes, chosen in `web/config.js`:

- **GitHub only** (`GITHUB_REPO` set, `RELEASE_BASE` null, what rescue.2342.ai uses): the page lists the latest GitHub release through the API and starts the ISO as a normal browser download. GitHub serves assets without CORS headers, so the page cannot rewrite the image while it streams. Instead the downloaded ISO is dropped back onto the page: it finds the slot through the ISO9660 root directory and saves a configured copy built from lazy `Blob` slices, so nothing is loaded into memory and it takes seconds. Release assets are limited to 2 GiB, so only the online variant is attached to releases.
- **CORS host** (`RELEASE_BASE` set): the ISO host serves `release-<variant>.json` and the images with `Access-Control-Allow-Origin` for the page. Then the browser streams, patches and verifies in one go. Any static host works; the build workflow uploads with rclone to an S3-compatible bucket when `RELEASE_BUCKET` and the `R2_*` secrets are set.

The page itself is deployed to GitHub Pages at [rescue.2342.ai](https://rescue.2342.ai) by the `web` workflow.

## Build it yourself

```sh
nix build .#iso                 # online variant, ~1.6 GB
nix build .#iso-offline         # with the local model, ~4.2 GB
nix build .#release             # ISO + release.json
nix flake check                 # includes the end-to-end slot patch test (builds the ISO)
```

Bake a configuration in at build time, for a personal stick:

```nix
# flake.nix of your own project
{
  inputs.agentic-rescue.url = "github:2342-ai/agentic-rescue";
  outputs = { agentic-rescue, ... }: {
    packages.x86_64-linux.my-rescue = agentic-rescue.lib.mkIso {
      system = "x86_64-linux";
      config = {
        providers.groq.key = "gsk_...";
        wifi = [ { ssid = "Home"; psk = "..."; } ];
        ssh_authorized_keys = [ "ssh-ed25519 AAAA... me" ];
        keymap = "de";
      };
    };
  };
}
```

Anything set this way ends up in the Nix store of the build machine, world-readable. Fine for your own stick, not for an image you hand out.

Or import the modules into any iso-image based NixOS configuration:

```nix
modules = [
  "${nixpkgs}/nixos/modules/installer/cd-dvd/installation-cd-minimal.nix"
  agentic-rescue.nixosModules.default
  { rescue.inference.enable = true; }   # offline variant
];
```

Building the ISO needs an `x86_64-linux` builder. On a Mac, enable `nix.linux-builder` in nix-darwin or point `--builders` at a Linux host.

## Providers

| Provider | Key variable | Free tier | opencode | Claude Code | Codex |
|---|---|---|---|---|---|
| [2342.ai](https://2342.ai) | `AI2342_API_KEY` | no, one budget | `2342ai/<model>` | via Messages API | via Responses API |
| [Groq](https://console.groq.com/keys) | `GROQ_API_KEY` | yes | yes | | |
| [Google AI Studio](https://aistudio.google.com/apikey) | `GEMINI_API_KEY` | yes | yes | | |
| [OpenRouter](https://openrouter.ai/keys) | `OPENROUTER_API_KEY` | `:free` models | yes | | |
| [OpenCode Zen](https://opencode.ai/auth) | `OPENCODE_API_KEY` | free models | yes | | |
| [Anthropic](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY` | no | yes | yes | |
| [OpenAI](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` | no | yes | | yes |
| local llama.cpp | none | offline variant | `local/local` | | |

Claude Code and Codex also accept their own subscription sign-in at the console (`rescue-connect login claude`, `rescue-connect login codex`); the QR handoff makes that painless without a browser on the machine.

## Security notes

- Keys in the slot are plain text. Whoever has the stick has the key. Create a key just for the stick and give it a budget.
- The live system runs as root with an empty password and no password SSH login. SSH works with keys from the slot only.
- `rescue-share` and the QR handoff serve plain HTTP on the local network behind a random token, and stop after one use or when you close them.
- The agents' guardrails are configuration and instructions, not a sandbox. They run as root on purpose; that is what a rescue system is for. Read what they propose before you say yes.

## Repository layout

```
flake.nix                 outputs: nixosConfigurations, packages.{iso,iso-offline,release,patch-iso,rescue-cli}, checks, lib.mkIso
modules/                  the NixOS modules (iso, config-slot, persist, console, network, storage, tools, agents, inference)
modules/agents/AGENTS.md  what the agents read at boot
pkgs/rescue-cli/          rescue, rescue-config, rescue-mount, rescue-enter, rescue-connect, rescue-handoff, rescue-share, rescue-persist, rescue-status
pkgs/patch-iso/           agentic-rescue-patch
pkgs/release/             ISO + release.json
checks/                   rescue-config unit test, patch tool test, end-to-end slot test on the real ISO
web/                      the download page
.github/workflows/        check (eval + fast tests), build (ISO, release.json, upload), web (Cloudflare Pages / GitHub Pages)
```

## Credits

The console-first design and the QR handoff for agent sign-ins follow [omarchy-rescue](https://github.com/crmne/omarchy-rescue) by Carmine Paolino, which does this for Omarchy on Arch. Agentic Rescue generalises the idea to any installed system, adds the configuration slot and is built with Nix.

Made by [2342.ai](https://2342.ai) and [anycast.io](https://anycast.io). MIT licensed.
