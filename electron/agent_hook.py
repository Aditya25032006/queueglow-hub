"""Relay Codex lifecycle events without forwarding prompts, outputs or approvals."""
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

EVENTS = {
    "SessionStart": ("start", "Session started"),
    "PreToolUse": ("activity", "Tool starting"),
    "PostToolUse": ("activity", "Tool finished"),
    "Stop": ("done", "Session finished"),
}


def main():
    root = Path(sys.argv[1])
    payload = json.loads(sys.stdin.buffer.read(1024 * 1024 + 1))
    name = payload.get("hook_event_name")
    if name not in EVENTS:
        return
    kind, summary = EVENTS[name]
    tool = payload.get("tool_name", "")
    if kind == "activity" and isinstance(tool, str) and re.fullmatch(r"[\w.-]{1,60}", tool):
        summary += ": " + tool
    session = payload.get("session_id", "")
    if not isinstance(session, str) or not re.fullmatch(r"[\w.-]{1,120}", session):
        session = "local"
    event_id = str(uuid.uuid4())
    inbox = root / "ipc" / "inbox"
    inbox.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = inbox / ("." + event_id + ".tmp")
    with temporary.open("x") as file:
        json.dump({
            "id": event_id, "provider": "codex", "session_id": "codex:" + session,
            "kind": kind, "summary": summary, "detail": "",
            "happened_at": datetime.now(timezone.utc).isoformat(), "expires_at": None,
        }, file)
    temporary.replace(inbox / (event_id + ".json"))


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except (OSError, ValueError, AttributeError, IndexError):
        print("Queueglow could not relay the Codex event.", file=sys.stderr)
