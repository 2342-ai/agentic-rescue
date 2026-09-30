# Hardware diagnosis, system inspection, backup and a comfortable shell.
{ pkgs, ... }:
{
  environment.systemPackages = with pkgs; [
    # hardware
    lshw
    hwinfo
    inxi
    lm_sensors
    dmidecode
    pciutils
    usbutils
    memtester
    stress-ng
    fastfetch

    # system inspection
    btop
    htop
    iotop
    lsof
    strace
    ncdu

    # backup and transfer
    rsync
    rclone
    restic
    borgbackup
    p7zip
    zip
    unzip

    # shell and editing
    git
    gh
    neovim
    ripgrep
    fd
    jq
    yq-go
    eza
    bat
    zoxide
    fzf
    gum
    figlet
    python3
    tmux
  ];

  programs.zoxide.enable = true;
  programs.fzf.keybindings = true;
}
