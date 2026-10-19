"""Offline tests for device/eval_grade.py.  python3 -I device/tests/test_eval_grade.py"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import eval_grade as g  # noqa: E402

CASE = {"id": "c", "expect_regex": "391", "expect_tool": None, "needs_approval": False, "offline": True}
OK = {"ok": True, "response": "It is 391.", "tools_used": [], "tok_s": 9.2, "ttft_ms": 800}


class Grade(unittest.TestCase):
    def test_pass_case_insensitive(self):
        self.assertEqual(g.grade(dict(CASE, expect_regex="IT IS"), OK)[0], g.PASS)

    def test_regex_miss(self):
        self.assertEqual(g.grade(dict(CASE, expect_regex="999"), OK)[0], g.FAIL)

    def test_missing_tool(self):
        self.assertEqual(g.grade(dict(CASE, expect_tool="search_notes"), OK)[0], g.FAIL)
        r = dict(OK, tools_used=["x", "search_notes"])
        self.assertEqual(g.grade(dict(CASE, expect_tool="search_notes"), r)[0], g.PASS)

    def test_not_ok(self):
        st, why = g.grade(CASE, {"ok": False, "response": "391", "error": "timed out"})
        self.assertEqual(st, g.FAIL)
        self.assertIn("timed out", why)



class Approval(unittest.TestCase):
    """The approval hook: needs_approval cases need an Allow-ed dialog."""
    DLG = {"title": "Set brightness", "message": "Set the screen brightness to 40%?", "choice": "allow",
           "mismatch": False}
    AP = dict(CASE, needs_approval=True, approve_match=r"Set the screen brightness to 40%\?")

    def test_needs_approval_passes_after_allow(self):
        r = dict(OK, approvals=[self.DLG])
        self.assertEqual(g.grade(self.AP, r), (g.PASS, ""))

    def test_needs_approval_without_approve_match_fails(self):
        r = dict(OK, approvals=[self.DLG])
        st, why = g.grade(dict(CASE, needs_approval=True), r)
        self.assertEqual(st, g.FAIL)
        self.assertIn("approve_match", why)

    def test_mismatched_dialog_fails(self):
        r = dict(OK, approvals=[dict(self.DLG, choice="deny", mismatch=True, message="svc·wifi·disable")])
        st, why = g.grade(self.AP, r)
        self.assertEqual(st, g.FAIL)
        self.assertIn("did not match", why)

    def test_needs_approval_without_dialog_fails(self):
        st, why = g.grade(self.AP, OK)
        self.assertEqual(st, g.FAIL)
        self.assertIn("no approval dialog", why)

    def test_needs_approval_denied_dialog_fails(self):
        r = dict(OK, approvals=[dict(self.DLG, choice="deny")])
        self.assertEqual(g.grade(self.AP, r)[0], g.FAIL)

    def test_needs_approval_still_checks_regex_and_tool(self):
        r = dict(OK, approvals=[self.DLG])
        self.assertEqual(g.grade(dict(self.AP, expect_regex="999"), r)[0], g.FAIL)
        self.assertEqual(g.grade(dict(self.AP, expect_tool="tablet_set_brightness"), r)[0], g.FAIL)

    def test_unexpected_dialog_fails_other_cases(self):
        r = dict(OK, approvals=[dict(self.DLG, choice="deny", message="Run: svc wifi disable")])
        st, why = g.grade(CASE, r)
        self.assertEqual(st, g.FAIL)
        self.assertIn("svc wifi disable", why)

    def test_never_skips_any_more(self):
        self.assertNotEqual(g.grade(dict(CASE, needs_approval=True), OK)[0], g.SKIP)


class Crash(unittest.TestCase):
    def test_bad_regex_is_fail(self):
        st, why = g.grade(dict(CASE, expect_regex="("), OK)
        self.assertEqual(st, g.FAIL)
        self.assertIn("grader error", why)

    def test_missing_key_is_fail(self):
        case = {"id": "c"}  # no expect_regex
        self.assertEqual(g.grade(case, OK)[0], g.FAIL)

    def test_garbage_result_is_fail(self):
        self.assertEqual(g.grade(CASE, None)[0], g.FAIL)


class Rows(unittest.TestCase):
    def test_row_escapes_pipes_and_truncates(self):
        r = g.row("2026-10-19 10:00", CASE, g.PASS, dict(OK, response="a | b\n" + "x" * 200, tools_used=["t1", "t2"]))
        self.assertIn("a \\| b", r)
        self.assertIn("t1,t2", r)
        self.assertNotIn("\n", r)
        self.assertEqual(r.count(" | "), 6)  # 7 cells; the escaped pipe has no leading space
        self.assertLess(len(r), 220)

    def test_select(self):
        cs = [{"id": "base-a", "offline": True}, {"id": "base-b", "offline": False}, {"id": "x-1", "offline": True}]
        self.assertEqual([c["id"] for c in g.select(cs, only="base")], ["base-a", "base-b"])
        self.assertEqual([c["id"] for c in g.select(cs, offline=True)], ["base-a", "x-1"])


if __name__ == "__main__":
    unittest.main()
