# The console: kmscon on tty1 with a real font and truecolor, Tokyo Night
# palette, root auto-login into a shared tmux session.
{
  config,
  lib,
  pkgs,
  ...
}:
let
  rescueCli = config.rescue.package;

  # Tokyo Night (night). kmscon wants decimal R,G,B.
  palette = {
    background = "26,27,38";
    foreground = "192,202,245";
    black = "21,22,30";
    red = "247,118,142";
    green = "158,206,106";
    yellow = "224,175,104";
    blue = "122,162,247";
    magenta = "187,154,247";
    cyan = "125,207,255";
    light-grey = "169,177,214";
    dark-grey = "65,72,104";
    light-red = "247,118,142";
    light-green = "158,206,106";
    light-yellow = "224,175,104";
    light-blue = "122,162,247";
    light-magenta = "187,154,247";
    light-cyan = "125,207,255";
    white = "192,202,245";
  };

  kmsconSettings = {
    font-name = "JetBrainsMono Nerd Font Mono";
    font-size = 15;
    font-dpi = 96;
    sb-size = 10000;
    palette = "custom";
    xkb-layout = "us";
  }
  // lib.mapAttrs' (name: value: lib.nameValuePair "palette-${name}" value) palette;

  # Written by hand rather than through services.kmscon.config, because the
  # keymap from the configuration slot is appended at boot by rescue-config.
  kmsconBaseConf = lib.generators.toKeyValue { } kmsconSettings;

  loginRoot = "${pkgs.shadow}/bin/login -p -f -- root";
in
{
  services.kmscon.enable = true;

  fonts.fontconfig.enable = true;
  fonts.packages = [ pkgs.nerd-fonts.jetbrains-mono ];

  environment.etc."agentic-rescue/kmscon.conf.base".text = kmsconBaseConf;

  systemd.services."kmsconvt@" = {
    after = [ "agentic-rescue-config.service" ];
    wants = [ "agentic-rescue-config.service" ];
    serviceConfig = {
      # Fall back to the base configuration if rescue-config did not run.
      ExecStartPre = pkgs.writeShellScript "kmscon-conf" ''
        if [ ! -f /run/agentic-rescue/kmscon/kmscon.conf ]; then
          mkdir -p /run/agentic-rescue/kmscon
          cp /etc/agentic-rescue/kmscon.conf.base /run/agentic-rescue/kmscon/kmscon.conf
        fi
      '';
      ExecStart = lib.mkForce [
        ""
        (lib.concatStringsSep " " [
          (lib.getExe config.services.kmscon.package)
          "--configdir /run/agentic-rescue/kmscon"
          "--vt=%I"
          "--no-switchvt"
          "--login"
          "--"
          loginRoot
        ])
      ];
    };
  };

  console = {
    earlySetup = true;
    keyMap = lib.mkDefault "us";
  };

  programs.tmux = {
    enable = true;
    terminal = "tmux-256color";
    historyLimit = 50000;
    escapeTime = 10;
    extraConfig = ''
      source-file ${rescueCli}/share/agentic-rescue/tmux.conf
    '';
  };

  programs.starship = {
    enable = true;
    settings = {
      add_newline = false;
      format = "$directory$character";
      directory.style = "bold blue";
      character = {
        success_symbol = "[›](bold green)";
        error_symbol = "[›](bold red)";
      };
    };
  };

  programs.bash = {
    # Every interactive login on the console lands in the shared tmux session.
    # SSH logins get a hint instead so that a phone or laptop can attach.
    interactiveShellInit = ''
      if [ -z "$TMUX" ] && [ -z "$SSH_CONNECTION" ] && [ -t 0 ] && [ "$(id -u)" = 0 ]; then
        exec ${pkgs.tmux}/bin/tmux new-session -A -s rescue
      fi
      if [ -n "$TMUX" ] && [ "$TMUX_PANE" = "%0" ] && [ ! -e /run/agentic-rescue/welcomed ]; then
        touch /run/agentic-rescue/welcomed 2>/dev/null
        ${rescueCli}/bin/rescue boot
      fi
      if [ -n "$SSH_CONNECTION" ] && [ -z "$TMUX" ]; then
        echo "Agentic Rescue. Attach to the console session with: tmux attach -t rescue"
      fi
    '';
    shellAliases = {
      ls = "eza";
      ll = "eza -la";
      cat = "bat --paging=never --style=plain";
    };
  };

  environment.variables = {
    EDITOR = "nvim";
    COLORTERM = "truecolor";
  };

  # Provider keys and other runtime settings written by rescue-config.
  environment.extraInit = ''
    if [ -r /run/agentic-rescue/env ]; then
      set -a
      . /run/agentic-rescue/env
      set +a
    fi
  '';
}
