#!/usr/bin/env python3
"""Boot an Agentic Rescue ISO in QEMU on the serial console and check that the
configuration slot was applied.

  tests/boot-qemu.py ISO [--expect KEY=VALUE ...] [--timeout SEC] [--keep]

Direct kernel boot: kernel, initrd and the init= parameter are taken from the
ISO's isolinux.cfg, so no boot menu interaction is needed. The root autologin on
the serial console lands in tmux; commands are typed there and the output is
checked. Needs qemu-system-x86_64 and xorriso in PATH, KVM if available.
"""

import argparse
import os
import pty
import re
import select
import shutil
import subprocess
import sys
import tempfile
import time


def extract(iso, path, dest):
    subprocess.run(["xorriso", "-indev", iso, "-osirrox", "on", "-extract", path, dest],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.chmod(dest, 0o644)


def boot_params(iso, work):
    cfg = os.path.join(work, "isolinux.cfg")
    extract(iso, "/isolinux/isolinux.cfg", cfg)
    text = open(cfg, encoding="utf-8").read()
    # First LABEL block is the default entry.
    m = re.search(r"LABEL\s+\S+.*?LINUX\s+(\S+).*?APPEND\s+(.*?)\n.*?INITRD\s+(\S+)", text, re.S)
    if not m:
        raise SystemExit("could not parse isolinux.cfg")
    kernel, append, initrd = m.group(1), m.group(2).strip(), m.group(3)
    kpath, ipath = os.path.join(work, "kernel"), os.path.join(work, "initrd")
    extract(iso, kernel, kpath)
    extract(iso, initrd, ipath)
    return kpath, ipath, append


def read_until(fd, patterns, timeout, log):
    buf = b""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r, _, _ = select.select([fd], [], [], 1)
        if not r:
            continue
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        buf += data
        log.write(data)
        log.flush()
        text = buf.decode("utf-8", "replace")
        for pat in patterns:
            if re.search(pat, text):
                return text
    raise TimeoutError(f"none of {patterns} seen within {timeout}s")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("iso")
    ap.add_argument("--expect", action="append", default=[], help="KEY=VALUE expected in /run/agentic-rescue/env")
    ap.add_argument("--timeout", type=int, default=240)
    ap.add_argument("--memory", default="3G")
    ap.add_argument("--keep", action="store_true", help="keep the work directory and serial log")
    args = ap.parse_args()

    work = tempfile.mkdtemp(prefix="rescue-boot-")
    log = open(os.path.join(work, "serial.log"), "wb")
    kernel, initrd, append = boot_params(args.iso, work)
    append = re.sub(r"\s*console=\S+", "", append) + " console=ttyS0,115200n8 systemd.show_status=false"

    cmd = ["qemu-system-x86_64", "-m", args.memory, "-smp", "2", "-nographic", "-serial", "mon:stdio",
           "-cdrom", args.iso, "-boot", "d", "-kernel", kernel, "-initrd", initrd, "-append", append,
           "-netdev", "user,id=n0", "-device", "virtio-net-pci,netdev=n0", "-no-reboot"]
    if os.path.exists("/dev/kvm") and os.access("/dev/kvm", os.R_OK | os.W_OK):
        cmd[1:1] = ["-enable-kvm", "-cpu", "host"]
    print("qemu:", " ".join(cmd[:8]), "...", file=sys.stderr)

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(cmd[0], cmd)

    ok = True
    try:
        # Root autologin drops into tmux and opens the menu; Escape leaves it and
        # prints the command overview.
        read_until(fd, [r"What do you want to do"], args.timeout, log)
        time.sleep(1.5)
        os.write(fd, b"\x1b")
        read_until(fd, [r"C-Space \?"], 30, log)
        time.sleep(1)
        marker = "RESCUE_CHECK_%d" % int(time.time())
        # The marker is assembled by the shell so the echoed command line does not contain it.
        script = (
            f"M={marker}; echo $M-BEGIN; echo SERVICE=$(systemctl is-active agentic-rescue-config); "
            "cat /run/agentic-rescue/env; rescue-config state; "
            "grep xkb-layout /run/agentic-rescue/kmscon/kmscon.conf; "
            "test -f /root/.config/opencode/opencode.json && echo OPENCODE_CONFIG_OK; "
            "test -f /root/.codex/config.toml && echo CODEX_CONFIG_OK; "
            "test -f /root/.claude/settings.json && echo CLAUDE_CONFIG_OK; "
            "rescue-status >/dev/null; echo STATUS_EXIT=$?; "
            "rescue welcome >/dev/null; echo WELCOME_EXIT=$?; "
            "rescue help >/dev/null; echo HELP_EXIT=$?; "
            "ls /var/lib/iwd/ 2>/dev/null; "
            "systemctl --failed --no-legend | head -5; "
            "echo $M-END\n"
        )
        os.write(fd, script.encode())
        text = read_until(fd, [f"{marker}-END"], 60, log)
        body = text.split(f"{marker}-BEGIN", 1)[-1]
        body = re.sub(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b[()][A-Z0-9]|\x1b\][^\x07\x1b]*(\x07|\x1b\\\\)", "", body)
        print("\n----- console output -----\n" + body.strip() + "\n--------------------------\n")
        checks = {"config service active": "SERVICE=active" in body,
                  "opencode config": "OPENCODE_CONFIG_OK" in body,
                  "codex config": "CODEX_CONFIG_OK" in body,
                  "claude config": "CLAUDE_CONFIG_OK" in body,
                  "rescue-status exits 0": "STATUS_EXIT=0" in body,
                  "welcome exits 0": "WELCOME_EXIT=0" in body,
                  "help exits 0": "HELP_EXIT=0" in body}
        for kv in args.expect:
            checks[f"env {kv}"] = kv in body
        for name, passed in checks.items():
            print(("PASS " if passed else "FAIL ") + name)
            ok = ok and passed
        os.write(fd, b"systemctl poweroff\n")
        try:
            read_until(fd, [r"reboot: Power down", r"Power down"], 30, log)
        except TimeoutError:
            pass
    except TimeoutError as exc:
        print("FAIL", exc)
        ok = False
    finally:
        try:
            os.kill(pid, 9)
        except ProcessLookupError:
            pass
        log.close()
        if args.keep or not ok:
            print(f"serial log: {log.name}")
        else:
            shutil.rmtree(work, ignore_errors=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
