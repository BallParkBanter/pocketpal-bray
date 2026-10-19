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

    def test_skip_needs_approval(self):
        self.assertEqual(g.grade(dict(CASE, needs_approval=True), OK)[0], g.SKIP)


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
