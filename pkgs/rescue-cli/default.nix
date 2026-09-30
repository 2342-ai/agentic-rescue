{
  lib,
  stdenvNoCC,
  makeWrapper,
  python3,
  bash,
  coreutils,
  util-linux,
  gum,
  figlet,
  tmux,
  qrencode,
  ttyd,
  iproute2,
  cryptsetup,
  lvm2,
  mdadm,
  zfs,
  btrfs-progs,
  jq,
  arch-install-scripts,
  nixos-install-tools,
  gptfdisk,
  parted,
  exfatprogs,
  openssl,
  kbd,
  systemd,
  curl,
  shellcheck,
  runCommand,
}:
let
  runtimePath = lib.makeBinPath [
    bash
    coreutils
    util-linux
    gum
    figlet
    tmux
    qrencode
    ttyd
    iproute2
    cryptsetup
    lvm2
    mdadm
    zfs
    btrfs-progs
    jq
    arch-install-scripts
    nixos-install-tools
    gptfdisk
    parted
    exfatprogs
    openssl
    kbd
    systemd
    curl
    python3
  ];
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "rescue-cli";
  version = "0.1.0";

  src = ./.;

  nativeBuildInputs = [ makeWrapper ];
  buildInputs = [ python3 ];

  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/bin $out/share/agentic-rescue
    for f in bin/*; do
      install -Dm755 "$f" "$out/bin/$(basename "$f")"
    done
    cp -r share/. $out/share/agentic-rescue/
    patchShebangs $out/bin
    for f in $out/bin/*; do
      wrapProgram "$f" --prefix PATH : ${runtimePath}
    done
    runHook postInstall
  '';

  passthru.tests.shellcheck =
    runCommand "rescue-cli-shellcheck" { nativeBuildInputs = [ shellcheck ]; }
      ''
        for f in ${finalAttrs.src}/bin/*; do
          if head -1 "$f" | grep -q bash; then shellcheck -x "$f"; fi
        done
        export PYTHONPYCACHEPREFIX="$TMPDIR/pycache"
        for f in ${finalAttrs.src}/bin/*; do
          if head -1 "$f" | grep -q python; then ${python3}/bin/python3 -m py_compile "$f"; fi
        done
        touch $out
      '';

  meta = {
    description = "Agentic Rescue helper commands";
    license = lib.licenses.mit;
    mainProgram = "rescue";
    platforms = lib.platforms.linux;
  };
})
