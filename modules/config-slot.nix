# The configuration slot: a fixed-size JSON file in the ISO9660 root that can
# be overwritten in place after the image has been built (by the download
# page, by `nix run .#patch`, or by anything that can write bytes at an
# offset). At boot it is readable as /iso/rescue-config.json.
#
# The slot content must always contain the compact magic string
# "slot":"agentic-rescue-config-v1" so that patch tools can locate it without
# a sidecar file.
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.rescue;

  # Build-time baked configuration, if any. builtins.toJSON writes compact
  # JSON with sorted keys, so the magic marker appears exactly once in its
  # compact form.
  content = builtins.toJSON (
    {
      v = 1;
      slot = cfg.slot.magic;
    }
    // (if cfg.config != null then cfg.config else { })
  );

  slotFile =
    pkgs.runCommand "rescue-config-slot.json"
      {
        inherit content;
        passAsFile = [ "content" ];
        slotLength = cfg.slot.length;
      }
      ''
        size=$(stat -c %s "$contentPath")
        if [ "$size" -gt "$slotLength" ]; then
          echo "rescue.config is $size bytes, the slot holds $slotLength" >&2
          exit 1
        fi
        cp "$contentPath" "$out"
        head -c "$((slotLength - size))" /dev/zero | tr '\0' ' ' >> "$out"
        test "$(stat -c %s "$out")" -eq "$slotLength"
      '';
in
{
  options.rescue = {
    config = lib.mkOption {
      type = lib.types.nullOr (lib.types.attrsOf lib.types.anything);
      default = null;
      example = lib.literalExpression ''
        {
          providers.groq.key = "gsk_...";
          model = "groq/openai/gpt-oss-120b";
          wifi = [ { ssid = "Home"; psk = "secret"; } ];
          ssh_authorized_keys = [ "ssh-ed25519 AAAA... me" ];
          keymap = "de";
        }
      '';
      description = ''
        Configuration baked into the slot at build time. Anything set here ends
        up world-readable in the Nix store of the build machine and in the ISO.
        Leave it null for a generic image and patch the slot after the build.
      '';
    };

    slot.length = lib.mkOption {
      type = lib.types.int;
      default = 16384;
      readOnly = true;
      description = "Size of the configuration slot in bytes.";
    };

    slot.magic = lib.mkOption {
      type = lib.types.str;
      default = "agentic-rescue-config-v1";
      readOnly = true;
      description = "Marker value stored under the \"slot\" key; patch tools search for it.";
    };
  };

  config = {
    isoImage.contents = [
      {
        source = slotFile;
        target = "/rescue-config.json";
      }
    ];

    environment.etc."agentic-rescue/slot.json".text = builtins.toJSON {
      inherit (cfg.slot) length magic;
      path = "/iso/rescue-config.json";
    };
  };
}
