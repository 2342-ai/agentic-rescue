# Optional writable partition on the stick, labelled RESCUE_DATA. If present it
# is mounted at /persist and its rescue-config.json overrides the ISO slot.
# `rescue persist` creates it in the free space behind the ISO partitions.
{ lib, ... }:
{
  fileSystems."/persist" = lib.mkImageMediaOverride {
    device = "/dev/disk/by-label/RESCUE_DATA";
    fsType = "auto";
    options = [
      "nofail"
      "noatime"
      "x-systemd.device-timeout=5s"
    ];
  };
}
