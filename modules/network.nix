# Networking: iwd with impala for Wi-Fi, systemd-resolved, sshd, tailscale.
{ lib, pkgs, ... }:
{
  # The installer profile enables NetworkManager; the rescue system uses iwd
  # directly, which impala drives from the terminal.
  networking.networkmanager.enable = lib.mkForce false;
  networking.wireless.iwd = {
    enable = true;
    settings = {
      General.EnableNetworkConfiguration = true;
      Network.NameResolvingService = "systemd";
      Settings.AutoConnect = true;
    };
  };
  networking.useDHCP = lib.mkDefault true;
  services.resolved.enable = true;

  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "yes";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  # Tailscale is installed and idle; `tailscale up --authkey ...` or the
  # tailscale_authkey slot field brings the machine into a tailnet.
  services.tailscale.enable = true;
  systemd.services.agentic-rescue-tailscale = {
    description = "Join the tailnet with the auth key from the configuration slot";
    wantedBy = [ "multi-user.target" ];
    after = [
      "tailscaled.service"
      "network-online.target"
    ];
    wants = [ "network-online.target" ];
    unitConfig.ConditionPathExists = "/run/agentic-rescue/tailscale-authkey";
    serviceConfig = {
      Type = "oneshot";
      ExecStart = "${pkgs.tailscale}/bin/tailscale up --ssh --hostname rescue --auth-key file:/run/agentic-rescue/tailscale-authkey";
    };
  };

  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      22
      7681 # rescue share (ttyd)
      7682 # rescue handoff (phone page)
    ];
    trustedInterfaces = [ "tailscale0" ];
  };

  environment.systemPackages = with pkgs; [
    impala
    iwd
    iw
    wirelesstools
    ethtool
    wireguard-tools
    mtr
    iperf3
    socat
    nmap
    tcpdump
    curl
    wget
    dig
    whois
  ];
}
