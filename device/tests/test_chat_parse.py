"""Offline tests for device/chat_parse.py (what chat.sh prints).

    python3 -I device/tests/test_chat_parse.py
"""
import json
import pathlib
import subprocess
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import chat_parse  # noqa: E402

FIXTURE = (HERE / "fixtures" / "tool-turn.xml").read_text(encoding="utf-8")


class ToolsUsed(unittest.TestCase):
    def test_call_order_and_repeats_kept(self):
        got = chat_parse.parse(FIXTURE)["tools_used"]
        # search_notes is called twice: both kept, in call order; failed call included.
        self.assertEqual(got, ["search_notes", "read_note", "search_notes", "read_note"])

    def test_order_comes_from_screen_position_not_document_order(self):
        # Reverse the chips' document order; screen order (y) must still win.
        a = FIXTURE.index('<node index="1" text="" resource-id="tool-used-chip"')
        b = FIXTURE.index('<node index="4" text="" resource-id="tool-error-block"')
        chips = FIXTURE[a:b].split("      </node>\n")[:-1]
        shuffled = FIXTURE[:a] + "".join(c + "      </node>\n" for c in reversed(chips)) + FIXTURE[b:]
        self.assertEqual(chat_parse.parse(shuffled)["tools_used"],
                         ["search_notes", "read_note", "search_notes", "read_note"])

    def test_no_chips(self):
        self.assertEqual(chat_parse.parse(FIXTURE.replace("tool-used-chip", "x").replace(
            "tool-error-block", "y"))["tools_used"], [])


class Reply(unittest.TestCase):
    def test_metrics(self):
        p = chat_parse.parse(FIXTURE)
        self.assertEqual((p["tok_s"], p["ttft_ms"]), (8.91, 1840))

    def test_response_excludes_chip_text(self):
        r = chat_parse.parse(FIXTURE)["response"]
        self.assertEqual(r, "Let me search your notes.\nThe batting cage plug is a Zooz ZEN14 outdoor plug.")

    def test_cli_json_line(self):
        out = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "q", "/tmp/s.png",
                              "1", "", str(HERE / "fixtures" / "tool-turn.xml")],
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)
        lines = out.stdout.splitlines()
        self.assertEqual(len(lines), 1)
        j = json.loads(lines[0])
        self.assertEqual(list(j), ["prompt", "response", "tok_s", "ttft_ms", "tools_used", "screenshot", "ok"])
        self.assertTrue(j["ok"])

    def test_cli_error_on_empty_dump(self):
        out = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "q", "", "0",
                              "device lock busy", "/nonexistent.xml"], capture_output=True, text=True)
        j = json.loads(out.stdout)
        self.assertEqual((out.returncode, j["ok"], j["error"]), (1, False, "device lock busy"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
