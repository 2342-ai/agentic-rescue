# Filesystems, block devices, encryption and disk forensics.
{ lib, pkgs, ... }:
{
  boot.supportedFilesystems = {
    zfs = true;
    btrfs = true;
    xfs = true;
    ext4 = true;
    vfat = true;
    ntfs = true;
    exfat = true;
    f2fs = true;
  };

  boot.zfs.forceImportRoot = false;
  networking.hostId = "a9e17c42";

  boot.swraid.enable = true;
  services.lvm.enable = true;

  environment.systemPackages =
    with pkgs;
    [
      cryptsetup
      lvm2
      mdadm
      btrfs-progs
      xfsprogs
      e2fsprogs
      dosfstools
      ntfs3g
      exfatprogs
      f2fs-tools
      parted
      gptfdisk
      util-linux
      ddrescue
      testdisk
      smartmontools
      nvme-cli
      hdparm
      sdparm
      efibootmgr
      efivar
      sbctl
      os-prober
      chntpw
      sleuthkit
      foremost
      partclone
      fsarchiver
      squashfsTools
      arch-install-scripts # arch-chroot works for any distribution root
      nixos-install-tools
    ]
    ++ lib.optional pkgs.stdenv.hostPlatform.isx86 pkgs.wimlib; # depends on syslinux, x86 only
}
