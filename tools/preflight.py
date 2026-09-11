#!/usr/bin/env python3
"""Pre-submission checks for the Chrome Web Store package.

    ./tools/package.sh && python3 tools/preflight.py

Verifies the manifest, the icons, the archive layout, the absence of remote
code — a frequent rejection cause — and the store listing length limits.
Exits non-zero if anything fails.
"""

import json
import pathlib
import re
import struct
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
failures = 0


def check(label, condition, detail=""):
    global failures
    print(("  OK    " if condition else "  FAIL  ") + label + (f"  — {detail}" if detail else ""))
    if not condition:
        failures += 1


def main():
    manifest = json.loads((ROOT / "extension" / "manifest.json").read_text())

    print("Manifest")
    check("manifest_version is 3", manifest.get("manifest_version") == 3)
    check(
        "version is numeric",
        bool(re.fullmatch(r"\d+(\.\d+){0,3}", manifest.get("version", ""))),
        manifest.get("version"),
    )
    check("name within 75 chars", len(manifest.get("name", "")) <= 75)
    check(
        "description within 132 chars",
        len(manifest.get("description", "")) <= 132,
        f'{len(manifest.get("description", ""))} chars',
    )
    check("four icon sizes declared", set(manifest.get("icons", {})) == {"16", "32", "48", "128"})
    check(
        "no permission beyond what the code uses",
        set(manifest.get("permissions", [])) == {"scripting", "downloads", "storage"},
        ", ".join(manifest.get("permissions", [])),
    )
    check(
        "host access limited to bad-asso.fr",
        all("bad-asso.fr" in host for host in manifest.get("host_permissions", [])),
    )

    print("\nIcons")
    for size, relative in sorted(manifest["icons"].items(), key=lambda kv: int(kv[0])):
        width, height = struct.unpack(">II", (ROOT / "extension" / relative).read_bytes()[16:24])
        check(relative, (width, height) == (int(size), int(size)), f"{width}x{height}")

    print("\nArchive")
    archive = ROOT / "dist" / f"badasso-calendar-{manifest['version']}.zip"
    if not archive.exists():
        check(f"{archive.name} exists", False, "run ./tools/package.sh first")
    else:
        bundle = zipfile.ZipFile(archive)
        names = bundle.namelist()
        check("manifest sits at the archive root", "manifest.json" in names)
        check("no dotfile", not any(n.split("/")[-1].startswith(".") for n in names))
        check("no __MACOSX metadata", not any("__MACOSX" in n for n in names))
        check("size stays reasonable", sum(i.file_size for i in bundle.infolist()) < 5_000_000)

    print("\nRemote code (a frequent rejection cause)")
    sources = "".join(
        (ROOT / "extension" / name).read_text() for name in ("core.js", "popup.js", "inpage.js")
    )
    check(
        "no external script is loaded",
        "http://" not in sources and not re.search(r'src\s*=\s*["\']https?://', sources),
    )
    check("no eval or new Function", "eval(" not in sources and "new Function" not in sources)

    print("\nListing")
    store = (ROOT / "STORE.md").read_text()
    short = store.split("## Description courte")[1].split("```")[1].strip()
    check("short description within 132 chars", len(short) <= 132, f"{len(short)} chars")

    print("\n=> " + ("ready to submit" if not failures else f"{failures} check(s) failed"))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
