# The agents (opencode, Claude Code, Codex) and the service that turns the
# configuration slot into their configuration files before anyone logs in.
{
  config,
  lib,
  pkgs,
  ...
}:
let
  rescueCli = config.rescue.package;
in
{
  environment.systemPackages = with pkgs; [
    opencode
    claude-code
    codex
    bubblewrap # Codex sandboxes commands with it; without it every command asks
    rescueCli
    qrencode
    ttyd
  ];

  environment.etc."agentic-rescue/AGENTS.md".source = ./agents/AGENTS.md;

  systemd.tmpfiles.rules = [
    "d /run/agentic-rescue 0755 root root -"
  ];

  systemd.services.agentic-rescue-config = {
    description = "Apply the Agentic Rescue configuration slot";
    wantedBy = [ "multi-user.target" ];
    after = [
      "local-fs.target"
      "persist.mount"
    ];
    before = [
      "kmsconvt@tty1.service"
      "getty.target"
      "sshd.service"
      "iwd.service"
      "tailscaled.service"
      "llama-cpp.service"
    ];
    unitConfig.RequiresMountsFor = "/iso";
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      ExecStart = "${rescueCli}/bin/rescue-config apply";
    };
    path = with pkgs; [
      kbd
      systemd
      tailscale
      coreutils
    ];
  };

  # The agents update themselves by default; a live system should not.
  environment.variables.DISABLE_AUTOUPDATER = "1";
}
