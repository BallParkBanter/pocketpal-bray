import os
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "push-notes.sh")


def run(mirror, extra=None):
    with tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as fake:
        log = os.path.join(fake, "adb.log")
        adb = os.path.join(fake, "adb")
        with open(adb, "w") as f:
            f.write(f'#!/bin/sh\necho "$@" >> {log}\n')
        os.chmod(adb, 0o755)
        env = dict(os.environ, BRAY_MIRROR=mirror, BRAY_NOTES_OUT=out, PATH=fake + ":" + os.environ["PATH"])
        env.update(extra or {})
        p = subprocess.run(["bash", SCRIPT], env=env, capture_output=True, text=True)
        return p, os.path.exists(log)


def test_missing_mirror_aborts_without_touching_tablet():
    p, adb_called = run("/nonexistent/mirror")
    assert p.returncode == 3 and "not a directory" in p.stderr
    assert not adb_called


def test_empty_export_aborts_without_touching_tablet():
    with tempfile.TemporaryDirectory() as m:
        p, adb_called = run(m)
    assert p.returncode == 3 and "aborting" in p.stderr
    assert not adb_called


def test_dry_run_passes_when_enough_notes():
    with tempfile.TemporaryDirectory() as m:
        for i in range(3):
            with open(os.path.join(m, f"n{i}.md"), "w") as f:
                f.write(f'---\ntitle: "N{i}"\njoplin-id: "{i:032x}"\nfolder: "F"\n---\nbody{i}\n')
        p, adb_called = run(m, {"BRAY_MIN_NOTES": "3", "BRAY_DRY_RUN": "1"})
    assert p.returncode == 0 and "would push 3 notes" in p.stdout
    assert not adb_called
