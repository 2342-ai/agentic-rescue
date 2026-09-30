# Agentic Rescue: all modules in one import.
#
# Import this into a NixOS configuration that also imports
# nixos/modules/installer/cd-dvd/installation-cd-minimal.nix (or any iso-image
# based profile) to get the complete rescue system.
{ lib, pkgs, ... }:
{
  imports = [
    ./iso.nix
    ./config-slot.nix
    ./persist.nix
    ./console.nix
    ./network.nix
    ./storage.nix
    ./tools.nix
    ./agents.nix
    ./inference.nix
  ];

  options.rescue.package = lib.mkOption {
    type = lib.types.package;
    default = pkgs.callPackage ../pkgs/rescue-cli { };
    defaultText = lib.literalExpression "pkgs.callPackage ../pkgs/rescue-cli { }";
    description = "The rescue-cli package providing the rescue, rescue-config, rescue-mount ... commands.";
  };
}
