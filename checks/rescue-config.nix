# rescue-config against a sample slot in a fake root: proves that keys land in
# the environment, all three agent configurations, iwd, ssh and kmscon.
{
  runCommand,
  rescue-cli,
  jq,
  python3,
}:
runCommand "check-rescue-config"
  {
    nativeBuildInputs = [
      rescue-cli
      jq
      python3
    ];
  }
  ''
    set -x
    root=$TMPDIR/root
    mkdir -p $root/iso $root/persist $root/etc/agentic-rescue
    printf 'font-name=JetBrainsMono Nerd Font Mono\nxkb-layout=us\n' > $root/etc/agentic-rescue/kmscon.conf.base
    cat > $root/etc/agentic-rescue/inference.json <<JSON
    {"enabled": true, "model": "test.gguf", "alias": "local", "baseURL": "http://127.0.0.1:8080/v1", "contextSize": 4096}
    JSON

    # ISO slot with padding, as the patch tool writes it.
    python3 - $root/iso/rescue-config.json <<'PY'
    import json, sys
    cfg = {"v": 1, "slot": "agentic-rescue-config-v1",
           "providers": {"2342ai": {"key": "k2342"}, "groq": {"key": "gsk_test"}},
           "wifi": [{"ssid": "Home Net", "psk": "secret"}, {"ssid": "Café", "psk": "x"}],
           "ssh_authorized_keys": ["ssh-ed25519 AAAATEST me"],
           "keymap": "de-latin1", "name": "Test Stick"}
    data = json.dumps(cfg, separators=(",", ":")).encode()
    open(sys.argv[1], "wb").write(data + b" " * (16384 - len(data)))
    PY
    # persist overrides the model
    echo '{"v":1,"model":"groq/openai/gpt-oss-120b"}' > $root/persist/rescue-config.json

    rescue-config --root $root apply > $TMPDIR/state.json
    cat $TMPDIR/state.json

    # environment
    grep -q "^AI2342_API_KEY=k2342$" $root/run/agentic-rescue/env
    grep -q "^GROQ_API_KEY=gsk_test$" $root/run/agentic-rescue/env
    test "$(stat -c %a $root/run/agentic-rescue/env)" = 600

    # opencode: custom 2342.ai provider, local provider, model from persist, destructive commands ask
    oc=$root/root/.config/opencode/opencode.json
    test "$(jq -r .model $oc)" = "groq/openai/gpt-oss-120b"
    test "$(jq -r '.provider."2342ai".options.baseURL' $oc)" = "https://2342.ai/v1"
    test "$(jq -r '.provider."2342ai".options.apiKey' $oc)" = "{env:AI2342_API_KEY}"
    test "$(jq -r '.provider.local.options.baseURL' $oc)" = "http://127.0.0.1:8080/v1"
    test "$(jq -r '.permission.bash."mkfs*"' $oc)" = ask
    test "$(jq -r '.permission.bash."*"' $oc)" = allow
    test "$(jq -r '.instructions[0]' $oc)" = /etc/agentic-rescue/AGENTS.md

    # Claude Code goes through 2342.ai because no Anthropic key is set
    cl=$root/root/.claude/settings.json
    test "$(jq -r .env.ANTHROPIC_BASE_URL $cl)" = "https://2342.ai"
    test "$(jq -r .env.ANTHROPIC_AUTH_TOKEN $cl)" = k2342
    test -L $root/root/.claude/CLAUDE.md

    # Codex goes through 2342.ai with the responses wire API
    cx=$root/root/.codex/config.toml
    grep -q '^model_provider = "2342ai"$' $cx
    grep -q '^base_url = "https://2342.ai/v1"$' $cx
    grep -q '^wire_api = "responses"$' $cx
    grep -q '^env_key = "AI2342_API_KEY"$' $cx

    # iwd: plain and hex-encoded SSID file names
    grep -q '^Passphrase=secret$' "$root/var/lib/iwd/Home Net.psk"
    test -f "$root/var/lib/iwd/=436166c3a9.psk"

    # ssh, keymap
    grep -q AAAATEST $root/root/.ssh/authorized_keys
    grep -q '^xkb-layout=de$' $root/run/agentic-rescue/kmscon/kmscon.conf
    ! grep -q '^xkb-layout=us$' $root/run/agentic-rescue/kmscon/kmscon.conf

    # runtime set/unset round trip, and masking
    rescue-config --root $root set providers.anthropic.key sk-ant-api03-verylongtestkey-1234
    test "$(jq -r .env.ANTHROPIC_BASE_URL $cl)" = null
    rescue-config --root $root show | grep -q 'sk-ant…1234'
    ! rescue-config --root $root show | grep -q verylongtestkey
    rescue-config --root $root unset providers.anthropic.key
    test "$(jq -r .env.ANTHROPIC_BASE_URL $cl)" = "https://2342.ai"

    # empty root: nothing configured, still valid output
    empty=$TMPDIR/empty
    mkdir -p $empty/iso
    rescue-config --root $empty apply | jq -e '.providers == [] and .model == null' > /dev/null
    test -f $empty/root/.config/opencode/opencode.json

    touch $out
  ''
