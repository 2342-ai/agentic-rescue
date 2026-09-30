# The ISO plus release.json: everything the download page needs to patch the
# configuration slot in the browser without touching the image on the server.
{
  lib,
  runCommand,
  xorriso,
  jq,
  iso,
  patch-iso,
  version,
  variant,
}:
runCommand "agentic-rescue-release-${variant}"
  {
    nativeBuildInputs = [
      xorriso
      jq
      patch-iso
    ];
    inherit version variant;
  }
  ''
    iso=$(echo ${iso}/iso/*.iso)
    name=$(basename "$iso")

    # Offset from the ISO9660 directory: LBA of the file's data times 2048.
    lba=$(xorriso -indev "$iso" -find / -name rescue-config.json -exec report_lba -- 2>/dev/null \
      | awk -F'[ ,]+' '/File data lba/ {print $5}')
    test -n "$lba"
    offset=$((lba * 2048))

    # Cross-check with the marker scan the patch tool does.
    scanned=$(agentic-rescue-patch "$iso" --locate)
    test "$(jq -r .configOffset <<<"$scanned")" -eq "$offset"
    length=$(jq -r .configLength <<<"$scanned")

    mkdir -p $out
    ln -s "$iso" "$out/$name"
    ln -s "$iso" "$out/agentic-rescue-${variant}.iso"
    jq -n \
      --arg v "$version" --arg variant "$variant" --arg iso "$name" \
      --argjson offset "$offset" --argjson length "$length" \
      --argjson size "$(stat -L -c %s "$iso")" \
      --arg sha256 "$(sha256sum "$iso" | cut -d' ' -f1)" \
      --arg magic '"slot":"agentic-rescue-config-v1"' \
      '{v: 1, version: $v, variant: $variant, iso: $iso, size: $size, sha256: $sha256,
        configOffset: $offset, configLength: $length, slotMagic: $magic}' > $out/release.json
    cat $out/release.json
  ''
