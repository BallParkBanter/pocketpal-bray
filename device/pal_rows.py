"""Find a Pal row in the Pals bottom sheet and say what chat.sh should do next.

The sheet's list is short (about 4 rows on the tablet) and its lower part sits behind
the chat input bar, so a row is only safe to tap when its title lies fully between
the tab row (Pals / Models) and the top of the input bar.

CLI: pal_rows.py <ui.xml> <title-regex>
  prints one of:
    tap X Y          the title is fully visible: tap there
    swipe X1 Y1 X2 Y2  scroll the list (inside the visible window) and look again
    missing X1 Y1 X2 Y2  no such row in the dump; the swipe that drags the list up
"""
import re
import sys
import xml.etree.ElementTree as ET

_B = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")


def _bounds(n):
    m = _B.match(n.get("bounds", ""))
    return tuple(int(v) for v in m.groups()) if m else None


def locate(root, title_rx):
    rx = re.compile(title_rx)
    nodes = list(root.iter("node"))
    top = bottom = None
    for n in nodes:
        b = _bounds(n)
        if not b:
            continue
        if n.get("content-desc") == "Models" or n.get("text") == "Models":
            top = max(top or 0, b[3])
        if n.get("resource-id") == "chat-input":
            bottom = b[1] - 40
    if top is None or bottom is None or bottom - top < 120:
        top, bottom = 760, 1300  # tablet defaults (2560x1600 landscape)
    target = None
    for n in nodes:
        if rx.search(n.get("text", "")):
            target = _bounds(n)
            if target:
                break
    span = max(80, min(250, (bottom - top) // 2))
    if target is None:
        # Not rendered: chat.sh scrolls to look for it. These are the coordinates
        # for dragging the list up (towards later rows); reverse them to go back.
        return ("missing", 1280, bottom - 30, 1280, bottom - 30 - span)
    x1, y1, x2, y2 = target
    x = (x1 + min(x2, x1 + 400)) // 2
    # uiautomator clips bounds to the list viewport, so a half-hidden title shows up as
    # a thin box: treat anything shorter than a normal title line as not visible.
    if y1 >= top and y2 <= bottom and y2 - y1 >= 40:
        return ("tap", x, (y1 + y2) // 2)
    if y2 > bottom or (y2 - y1 < 40 and y1 > top + 20):  # below the window: drag the list up
        return ("swipe", 1280, bottom - 30, 1280, bottom - 30 - span)
    return ("swipe", 1280, top + 30, 1280, top + 30 + span)  # above: drag down


def main(argv):
    root = ET.parse(argv[1]).getroot()
    print(" ".join(str(v) for v in locate(root, argv[2])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
