# Contributing

Thanks for looking. A few conventions keep this repository easy to work with.

## Working on it

```sh
nix develop                                   # xorriso, python, shellcheck, nixfmt, gum
nix fmt                                       # format Nix files (nixfmt-rfc-style)
nix build .#checks.x86_64-linux.rescue-config # fast: the slot -> config logic
nix build .#checks.x86_64-linux.patch-tool    # fast: the patch tool
nix build .#checks.x86_64-linux.shellcheck    # fast: bash and python syntax
nix build .#release                           # slow: the ISO and release.json
nix flake check                               # everything, including the end-to-end slot test
```

Boot the result in a VM:

```sh
nix shell nixpkgs#qemu -c qemu-system-x86_64 -enable-kvm -m 4G -cpu host \
  -cdrom result/iso/*.iso -boot d -serial mon:stdio -display none \
  -append "console=ttyS0"
```

(The default boot entry uses kmscon on the framebuffer; add `-display gtk` to see it, or pick the "basic console" entry.)

## Where things live

- `modules/` are plain NixOS modules. Keep them importable on their own; `modules/default.nix` wires them together.
- `pkgs/rescue-cli/bin/` are the commands on the live system. Bash for glue, Python (stdlib only) for anything with parsing or HTTP. Every script has a usage comment at the top that `--help` prints.
- `pkgs/rescue-cli/bin/rescue-config` owns the provider table. `web/providers.js` mirrors it for the download page; change both.
- `web/` has no build step and no dependencies. Keep it that way.

## Rules of the road

- Diagnose read-only first, ask before destroying: this applies to the helper scripts as much as to the agents. Anything that writes to a disk that is not the live system prompts with `gum confirm`.
- The slot format is versioned (`v`). Adding optional fields is fine; changing the meaning of an existing field bumps the version and keeps reading the old one.
- No code copied from omarchy-rescue (it has no license). Ideas are welcome, code is rewritten.
- Commits: one topic per commit, imperative subject line.

## Releasing

Tag `vX.Y.Z` on `main`. The `build` workflow builds both variants, runs the end-to-end slot check, uploads ISOs and `release-<variant>.json` to the release bucket and attaches them to the GitHub release. Bump `version` in `flake.nix` first.
