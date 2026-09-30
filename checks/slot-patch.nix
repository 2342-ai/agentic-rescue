# End to end on the real image: patch the slot using release.json, extract the
# file again through the ISO9660 directory and compare. Builds the ISO.
{
  runCommand,
  release,
  patch-iso,
  xorriso,
  jq,
}:
runCommand "check-slot-patch"
  {
    nativeBuildInputs = [
      patch-iso
      xorriso
      jq
    ];
  }
  ''
    set -x
    iso=$(readlink -f ${release}/agentic-rescue-*.iso | head -1)
    cp "$iso" $TMPDIR/test.iso
    chmod u+w $TMPDIR/test.iso

    agentic-rescue-patch $TMPDIR/test.iso --release ${release}/release.json \
      --provider groq --key gsk_e2e --wifi Lab pass1234 --keymap de --name "e2e"

    # The image is still a valid ISO9660 volume and the file reads back through the directory.
    xorriso -indev $TMPDIR/test.iso -osirrox on -extract /rescue-config.json $TMPDIR/slot.json 2>/dev/null
    jq -e '.providers.groq.key == "gsk_e2e" and .wifi[0].ssid == "Lab" and .keymap == "de"' $TMPDIR/slot.json
    test "$(stat -c %s $TMPDIR/slot.json)" -eq "$(jq -r .configLength ${release}/release.json)"

    # Unpatched image matches the published checksum, patched one differs only inside the slot.
    test "$(sha256sum "$iso" | cut -d' ' -f1)" = "$(jq -r .sha256 ${release}/release.json)"
    offset=$(jq -r .configOffset ${release}/release.json)
    cmp -n "$offset" "$iso" $TMPDIR/test.iso
    cmp -i "$((offset + 16384))" "$iso" $TMPDIR/test.iso

    touch $out
  ''
