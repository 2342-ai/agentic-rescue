# Identity, boot menu and live-media behaviour of the ISO.
{
  config,
  lib,
  pkgs,
  rescueVersion ? "dev",
  rescueOffline ? false,
  ...
}:
{
  system.nixos.distroName = "Agentic Rescue";
  system.nixos.label = rescueVersion;
  system.nixos.variant_id = "rescue";

  isoImage = {
    edition = "rescue";
    volumeID = "AGENTIC_RESCUE";
    appendToMenuLabel = "";
    squashfsCompression = "zstd -Xcompression-level 19";
    makeEfiBootable = true;
    makeUsbBootable = true;
  };

  image.baseName = lib.mkForce "agentic-rescue${lib.optionalString rescueOffline "-offline"}-${rescueVersion}-${pkgs.stdenv.hostPlatform.system}";

  # Second boot entry for machines whose GPU misbehaves with kernel modesetting:
  # plain kernel console, no kmscon.
  specialisation.basic-console.configuration = {
    isoImage.configurationName = "basic console";
    services.kmscon.enable = lib.mkForce false;
    boot.kernelParams = [ "nomodeset" ];
  };

  boot.loader.timeout = lib.mkForce 5;

  # Rescue systems want to see what the kernel says.
  boot.consoleLogLevel = 4;
  boot.kernelParams = [ "systemd.show_status=true" ];

  # Root is the only account that matters on a rescue stick. The installer
  # profile creates a "nixos" user; leave it in place but do not log it in.
  services.getty.autologinUser = lib.mkForce "root";
  services.getty.helpLine = lib.mkForce ''

    Agentic Rescue. Type `rescue` for the menu, `rescue --help` for the commands.
  '';
  users.users.nixos.extraGroups = lib.mkForce [ "wheel" ];

  networking.hostName = lib.mkDefault "rescue";

  # Slimmer image: no NixOS manual, but keep man pages for the tools.
  documentation.nixos.enable = lib.mkForce false;
  documentation.doc.enable = lib.mkForce false;
  documentation.info.enable = lib.mkForce false;
  documentation.man.enable = true;

  # The installer profile (channel.nix) already bundles the nixpkgs the image
  # was built from and points the flake registry and NIX_PATH at it, so
  # `nix run nixpkgs#foo` on the live system hits the binary cache.
  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];

  # Compressed swap in RAM helps small machines, and the local model in the
  # offline variant needs headroom.
  zramSwap = {
    enable = true;
    memoryPercent = 50;
  };

  nixpkgs.config.allowUnfree = true;

  system.stateVersion = lib.trivial.release;
}
