# The patch tool against a synthetic image: a random blob with one slot inside.
{
  runCommand,
  patch-iso,
  python3,
  jq,
}:
runCommand "check-patch-tool"
  {
    nativeBuildInputs = [
      patch-iso
      python3
      jq
    ];
  }
  ''
    set -x
    python3 - $TMPDIR/fake.iso <<'PY'
    import os, sys
    slot = b'{"slot":"agentic-rescue-config-v1","v":1}'
    slot += b" " * (16384 - len(slot))
    with open(sys.argv[1], "wb") as f:
        f.write(os.urandom(1_000_000))
        f.write(slot)
        f.write(os.urandom(500_000))
    PY
    loc=$(agentic-rescue-patch $TMPDIR/fake.iso --locate)
    echo "$loc"
    test "$(jq -r .configOffset <<<"$loc")" -eq 1000000
    test "$(jq -r .configLength <<<"$loc")" -eq 16384

    agentic-rescue-patch $TMPDIR/fake.iso -o $TMPDIR/out.iso \
      --provider groq --key gsk_abc --provider 2342ai --key k2 \
      --model groq/openai/gpt-oss-120b --wifi "Home Net" secret --ssh-key "ssh-ed25519 AAA me" --keymap de --name "Stick"
    test "$(stat -c %s $TMPDIR/out.iso)" -eq "$(stat -c %s $TMPDIR/fake.iso)"
    cmp -n 1000000 $TMPDIR/fake.iso $TMPDIR/out.iso
    cmp -i 1016384 $TMPDIR/fake.iso $TMPDIR/out.iso

    agentic-rescue-patch $TMPDIR/out.iso --extract > $TMPDIR/slot.json
    jq -e '.providers.groq.key == "gsk_abc" and .providers."2342ai".key == "k2" and .wifi[0].ssid == "Home Net" and .keymap == "de" and .slot == "agentic-rescue-config-v1"' $TMPDIR/slot.json

    # patch again in place with a config file: the marker survived, so it works without --release
    echo '{"providers":{"google":{"key":"AIza"}},"model":"google/gemini-flash-latest"}' > $TMPDIR/cfg.json
    agentic-rescue-patch $TMPDIR/out.iso --config $TMPDIR/cfg.json
    agentic-rescue-patch $TMPDIR/out.iso --extract | jq -e '.providers.google.key == "AIza" and (.providers.groq == null)'

    # oversize configuration is refused
    python3 -c 'import json; print(json.dumps({"name": "x" * 20000}))' > $TMPDIR/big.json
    if agentic-rescue-patch $TMPDIR/out.iso --config $TMPDIR/big.json 2>/dev/null; then exit 1; fi

    touch $out
  ''
