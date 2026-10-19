"""Offline tests for device/pal_rows.py.  python3 -I device/tests/test_pal_rows.py"""
import pathlib
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import pal_rows as p  # noqa: E402


def ui(*rows):
    """Tabs end at y=743, the chat input starts at y=1352 (window 743..1312)."""
    nodes = ['<node text="Models" content-desc="" resource-id="" bounds="[198,685][293,727]"/>',
             '<node text="" content-desc="Models" resource-id="" bounds="[166,669][325,743]"/>',
             '<node text="Model not loaded." content-desc="Message input" resource-id="chat-input" bounds="[48,1352][2512,1400]"/>']
    nodes += ['<node text="%s" content-desc="" resource-id="" bounds="[56,%d][2528,%d]"/>' % r for r in rows]
    return ET.fromstring("<hierarchy>%s</hierarchy>" % "".join(nodes))


class Locate(unittest.TestCase):
    def test_visible_row_is_tapped(self):
        self.assertEqual(p.locate(ui(("No Pal", 789, 836)), "^No Pal$"), ("tap", 256, 812))

    def test_row_clipped_at_top_scrolls_back(self):
        # uiautomator clips to the viewport: a 13 px tall title is half hidden.
        act = p.locate(ui(("Tablet Pal", 757, 770)), "^Tablet Pal$")
        self.assertEqual(act[0], "swipe")
        self.assertLess(act[2], act[4])  # finger moves down = list goes back

    def test_row_behind_input_bar_scrolls_forward(self):
        act = p.locate(ui(("Bray", 1290, 1337)), "^Bray$")
        self.assertEqual(act[0], "swipe")
        self.assertGreater(act[2], act[4])
        self.assertLessEqual(act[2], 1312)  # the swipe starts inside the list, not on the input bar

    def test_missing_row(self):
        act = p.locate(ui(("Lookie", 789, 836)), "^Bray$")
        self.assertEqual(act[0], "missing")
        self.assertGreater(act[2], act[4])

    def test_exact_title_only(self):
        self.assertEqual(p.locate(ui(("Bray Notes", 789, 836)), "^Bray$")[0], "missing")


if __name__ == "__main__":
    unittest.main()
