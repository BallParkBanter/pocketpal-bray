# device/ — drive PocketPal Bray on the Galaxy Tab S7

Scripts that install the Bray build on Bo's real tablet, chat with it, and take
screenshots. Everything goes over adb to whatever serial
`~/projects/galaxy-tab-s7/tablet status` reports (LAN `192.168.1.x:<port>` or the
Tailscale relay `localhost:5599`). Never hard-code the serial.

| Script | What it does |
|---|---|
| `install.sh <apk>` | `adb install -r`, then checks the package is `com.pocketpalai.bray` with `primaryCpuAbi=arm64-v8a`. Prints `installed com.pocketpalai.bray arm64-v8a`. |
| `chat.sh "<prompt>" [--pal "<name>"] [--timeout 180] [--keep-thinking]` | New chat, optional Pal, thinking OFF, types the prompt, waits for the reply. Prints one JSON line (below). Exit 0 if `ok`. |
| `shot.sh "<caption>"` | Screenshot, posted to Mattermost `galaxy-tab-s7` (`BRAY_MM_CHANNEL` overrides). Prints the PNG path. |
| `lib.sh` | Shared helpers (source it). |

## chat.sh output

```json
{"prompt": "What is 17 times 23?", "response": "...391...", "tok_s": 9.24, "ttft_ms": 896,
 "tools_used": [], "screenshot": "/tmp/bray-shots/chat-20261019-104310.png", "ok": true}
```

- `tok_s`, `ttft_ms` come from the reply footer (`108ms/token, 9.24 tokens/sec, 896ms TTFT`).
  A one-token reply reads `0.00 tokens/sec`; that is the app's number, not a parse bug.
- `response`: when the whole reply bubble fits on screen, it is the bubble's text nodes,
  one per line (code blocks included). Otherwise it falls back to the bubble's
  accessibility label, which joins paragraphs with `, ` and leaves out code-block bodies.
- `tools_used`: names from the `tool-used-chip` chips (`used <name> · …`), in order.
- On failure `ok` is `false` and an `error` field says why (`tablet locked or asleep — Bo must unlock`,
  `pal not found: X`, `timed out …`, `model not loaded …`).
- `--pal "No Pal"` clears the active Pal. Without `--pal` the current Pal stays.

## lib.sh functions

`dev_target` (adb serial), `dev_ready` (fails unless `mWakefulness=Awake` and
`isKeyguardShowing=false` — it never unlocks), `dev_ui_text` (`T: text` / `D: content-desc` lines),
`dev_ui_xml`, `dev_tap_text <regex> [after-regex]` (`id:<regex>` matches the React Native testID),
`dev_shot <out.png>` (≤2000 px, retries truncated relay captures), `dev_free_ram_mb`,
`dev_launch`, `dev_focus`, `dev_adb`.

**Locking.** Every function that touches the tablet runs under `flock /tmp/bray-device.lock`,
so parallel agents never drive the screen at once. The lock is re-entrant inside one
process tree (`dev_locked my_flow` holds it for a whole flow). `chat.sh` holds it for the
full run. Waits up to `BRAY_LOCK_WAIT` seconds (default 900).

## Things that will bite you

- **The model lives on the SD card, but the app copies it.** The GGUFs are at
  `/storage/6238-3662/AI-Models/`. *Models → + → Add Local Model* copies the picked file into
  the app's private storage (`RNFS.copyFile` in `ModelsScreen.tsx`). Internal storage grew by
  ~3.2 GB for Q4_0 + mmproj. The app runs from the internal copy.
- **Add Local Model does not pair an mmproj.** The `mmproj-…gguf` shows up as its own model
  card instead of Gemma's vision projector. Never load it as a chat model.
- **Backgrounding the app releases the model** (auto-release setting). `chat.sh` notices the
  "Model not loaded" placeholder and reloads the card matching `BRAY_MODEL_RX`
  (default `^gemma-4-E2B-it-Q4_0\.gguf$`), and retries once if the context drops mid-run.
  Never send BACK to close a sheet — it can background the app. Tap the backdrop.
- `adb shell input text` is ASCII-only, and a literal `%s` in a prompt types as a space.
- Speed: one `chat.sh` run takes ~1–1.5 min over the Tailscale relay (UI dumps are slow); add
  ~30 s when the model has to load.
- Safety: nothing here may disable Wi-Fi, reboot, or touch stock `com.pocketpalai`. If the
  tablet is locked, stop and ask Bo.
