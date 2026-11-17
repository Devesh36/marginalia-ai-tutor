#!/usr/bin/env python3
"""Save a Gemini key locally without echoing it or putting it in shell history."""
import getpass
import os
from pathlib import Path
import re
import sys
import tempfile


def main():
    if not sys.stdin.isatty():
        raise SystemExit("Run this script directly in your Terminal for hidden key entry.")
    key = getpass.getpass("Paste your Gemini API key (hidden), then press Enter: ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,512}", key):
        raise SystemExit("No changes made: the key was empty or had unexpected characters.")
    path = Path(__file__).resolve().parents[1] / ".env.local"
    lines = path.read_text().splitlines() if path.exists() else []
    updates = {"GEMINI_API_KEY": key, "AI_PROVIDER": "gemini"}
    output = []
    for line in lines:
        if any(re.match(rf"^\s*(?:export\s+)?{name}\s*=", line) for name in updates):
            continue
        output.append(line)
    output.extend(f"{name}={value}" for name, value in updates.items())
    fd, temporary = tempfile.mkstemp(prefix=".env.local.", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as file:
            file.write("\n".join(output) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("Saved Gemini configuration to ignored .env.local with owner-only permissions.")
    print("The key was not printed. You can now return to Codex and reply ready.")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        raise SystemExit("\nCanceled; no configuration changes made.")
