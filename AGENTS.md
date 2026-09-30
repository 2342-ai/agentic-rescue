# Agentic Rescue, for agents working on this repository

This is the source of a NixOS live rescue ISO. The file the agents *inside the
ISO* read is `modules/agents/AGENTS.md`; this one is for you, working on the
code.

- One flake, no flake-parts. `flake.nix` builds `nixosConfigurations.rescue-<system>`
  from `installation-cd-minimal.nix` plus `modules/default.nix`.
- The configuration slot (`modules/config-slot.nix`) is the contract between the
  build, the download page (`web/patch.js`), the patch tool
  (`pkgs/patch-iso/agentic-rescue-patch`) and the boot-time consumer
  (`pkgs/rescue-cli/bin/rescue-config`). Its marker string
  `"slot":"agentic-rescue-config-v1"` must stay byte-identical in all four.
- `rescue-config` is the single writer of agent configuration. Do not add other
  places that write `opencode.json`, `~/.claude/settings.json` or
  `~/.codex/config.toml`.
- Fast checks: `nix build .#checks.x86_64-linux.{rescue-config,patch-tool,shellcheck}`.
  They run in CI on every push. `slot-patch` builds the ISO and runs on tags.
- Formatting: `nix fmt`. Bash passes `shellcheck -x`. Python is stdlib only.
- Provider table lives twice on purpose (Python and JS). Change both.
