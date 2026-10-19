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
        self.assertEqual(list(j), ["prompt", "response", "tok_s", "ttft_ms", "tools_used", "screenshot", "approvals", "ok"])
        self.assertTrue(j["ok"])

    def test_cli_error_on_empty_dump(self):
        out = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "q", "", "0",
                              "device lock busy", "/nonexistent.xml"], capture_output=True, text=True)
        j = json.loads(out.stdout)
        self.assertEqual((out.returncode, j["ok"], j["error"]), (1, False, "device lock busy"))


FX = HERE / "fixtures"
DONE = (FX / "two-turn-done.xml").read_text(encoding="utf-8")
PENDING = (FX / "two-turn-pending.xml").read_text(encoding="utf-8")


class MultiTurn(unittest.TestCase):
    def test_parse_returns_newest_turn_only(self):
        p = chat_parse.parse(DONE)
        self.assertEqual(p["response"], "Teal")
        self.assertEqual(p["tools_used"], ["new_tool"])  # not old_tool
        self.assertEqual((p["tok_s"], p["ttft_ms"]), (6.1, 1689))

    def test_old_footer_alone_is_not_done(self):
        base = chat_parse.footer_texts(PENDING)  # baseline taken before the new reply
        self.assertEqual(len(base), 1)
        self.assertFalse(chat_parse.new_footer(base, chat_parse.footer_texts(PENDING)))

    def test_new_footer_is_done(self):
        base = chat_parse.footer_texts(PENDING)
        self.assertTrue(chat_parse.new_footer(base, chat_parse.footer_texts(DONE)))

    def test_no_footer_not_done_and_first_turn_done(self):
        self.assertFalse(chat_parse.new_footer([], []))
        self.assertTrue(chat_parse.new_footer([], chat_parse.footer_texts(DONE)))

    def test_footers_cli(self):
        out = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "--footers",
                              str(FX / "two-turn-done.xml")], capture_output=True, text=True)
        self.assertEqual(out.stdout.split("\t")[0], "2")


DIALOG = (HERE / "fixtures" / "approval-dialog.xml").read_text(encoding="utf-8")


class Dialog(unittest.TestCase):
    MATCH = r"Set the screen brightness to 40%\?"

    def test_allow_button_centre(self):
        d = chat_parse.approval_dialog(DIALOG, "allow", self.MATCH)
        self.assertEqual((d["x"], d["y"], d["choice"], d["mismatch"]), (1200, 1445, "allow", False))
        self.assertEqual(d["title"], "Set brightness")
        self.assertIn("40%", d["message"])

    def test_default_is_deny(self):
        d = chat_parse.approval_dialog(DIALOG)
        self.assertEqual((d["x"], d["y"], d["choice"]), (990, 1445, "deny"))

    def test_chat_screen_has_no_dialog(self):
        self.assertIsNone(chat_parse.approval_dialog(FIXTURE, "allow"))

    def test_shizuku_permission_dialog_is_never_answered(self):
        shizuku = (DIALOG.replace('package="com.pocketpalai.bray"', 'package="moe.shizuku.privileged.api"')
                   .replace('text="ALLOW"', 'text="Allow all the time"'))
        self.assertIsNone(chat_parse.approval_dialog(shizuku, "allow"))
        # Other package, even with exact Allow/Deny texts: not ours.
        other = DIALOG.replace('package="com.pocketpalai.bray"', 'package="moe.shizuku.privileged.api"')
        self.assertIsNone(chat_parse.approval_dialog(other, "allow"))

    def test_empty_reply_footer_counts_as_done(self):
        # Final step with no tokens: footer has no TTFT. Seen live after
        # tablet_set_brightness; it must not look like "still generating".
        xml = FIXTURE
        f = chat_parse.footer_texts(xml)[0]
        empty = xml.replace(f, "0ms/token, 0.00 tokens/sec")
        self.assertEqual(chat_parse.footer_texts(empty)[0], "0ms/token, 0.00 tokens/sec")
        self.assertIsNone(chat_parse.parse(empty)["ttft_ms"])

    def test_title_alert_title_id(self):
        real = DIALOG.replace(":id/alertTitle", ":id/alert_title")  # id seen live
        self.assertEqual(chat_parse.approval_dialog(real, "allow", self.MATCH)["title"], "Set brightness")

    def test_allow_without_match_is_deny(self):
        d = chat_parse.approval_dialog(DIALOG, "allow")
        self.assertEqual((d["choice"], d["mismatch"], d["x"]), ("deny", True, 990))

    def test_partial_or_other_message_is_deny(self):
        for rx in (r"Set the screen brightness", r".*41%.*", r"uptime", r"("):
            d = chat_parse.approval_dialog(DIALOG, "allow", rx)
            self.assertEqual((d["choice"], d["mismatch"]), ("deny", True), rx)

    def test_model_swaps_the_command(self):
        # The case expected `uptime`; the model asked for something else.
        other = DIALOG.replace("Set the screen brightness to 40%?", "svc·wifi·disable")
        d = chat_parse.approval_dialog(other, "allow", r"uptime")
        self.assertEqual((d["choice"], d["mismatch"]), ("deny", True))

    def test_chip_only_turn_is_an_empty_reply(self):
        # Seen live 2026-10-19 (tablet_list_files): the turn holds only the tool
        # chip and a TTFT-less footer. The chip label is not a reply.
        xml = """<hierarchy>
  <node resource-id="header-view" bounds="[0,0][1600,184]" text="" content-desc="" />
  <node resource-id="" text="" bounds="[0,1000][1600,1300]"
        content-desc="\U000f0be0, used tablet_list_files \u00b7 12 tokens \u00b7 1s, 0ms/token, 0.00 tokens/sec">
    <node resource-id="tool-used-chip" text="" content-desc="" bounds="[40,1100][600,1150]">
      <node resource-id="" text="used tablet_list_files \u00b7 12 tokens \u00b7 1s" content-desc="" bounds="[80,1100][600,1150]" />
    </node>
    <node resource-id="footer-timing" text="0ms/token, 0.00 tokens/sec" content-desc="" bounds="[80,1200][600,1240]" />
  </node>
</hierarchy>"""
        p = chat_parse.parse(xml)
        self.assertEqual(p["response"], "")
        self.assertEqual(p["tools_used"], ["tablet_list_files"])
        self.assertEqual(p["tok_s"], 0.0)

    def test_cli(self):
        p = HERE / "fixtures" / "approval-dialog.xml"
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "--dialog", str(p), "allow",
                            self.MATCH], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(json.loads(r.stdout)["x"], 1200)
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "--dialog", str(p), "allow"],
                           capture_output=True, text=True)
        self.assertEqual(json.loads(r.stdout)["choice"], "deny")
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "--dialog",
                            str(HERE / "fixtures" / "tool-turn.xml")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)

    def test_approvals_file_lands_in_json(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps({"title": "t", "choice": "allow"}) + "\n")
        r = subprocess.run([sys.executable, "-I", str(HERE.parent / "chat_parse.py"), "p", "", "1", "",
                            str(HERE / "fixtures" / "tool-turn.xml"), f.name], capture_output=True, text=True)
        self.assertEqual(json.loads(r.stdout)["approvals"], [{"title": "t", "choice": "allow"}])
        pathlib.Path(f.name).unlink()


class Front(unittest.TestCase):
    def xml(self, *pkgs):
        return "<hierarchy>" + "".join('<node package="%s" bounds="[0,0][1,1]" />' % p for p in pkgs) + "</hierarchy>"

    def test_decisions(self):
        f = chat_parse.front_decision
        self.assertEqual(f(FIXTURE), "ours")
        self.assertEqual(f(self.xml("com.github.libretube")), "relaunch")
        self.assertEqual(f(self.xml("moe.shizuku.privileged.api")), "wait")
        for sysp in ("com.android.systemui", "android", "com.google.android.permissioncontroller"):
            self.assertEqual(f(self.xml(sysp)), "system", sysp)
        # an app with a system dialog over it: still system
        self.assertEqual(f(self.xml("com.github.libretube", "android")), "system")
        self.assertEqual(f("not xml"), "system")


if __name__ == "__main__":
    unittest.main(verbosity=2)
