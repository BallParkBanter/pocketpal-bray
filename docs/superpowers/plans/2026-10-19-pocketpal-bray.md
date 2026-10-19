# PocketPal Bray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork PocketPal AI into "PocketPal Bray" with tablet-control (Shizuku) and offline-notes tools, validated on Bo's Galaxy Tab S7 by an automated on-device harness and eval suite.

**Architecture:** Upstream React Native app, unchanged engine (llama.rn). New tools are `TalentEngine` classes in `src/services/talents/bray/`, registered from `registerDefaultTalents()`. Tablet tools call a new TurboModule `ShizukuShell` (Kotlin, Shizuku UserService). Notes tools read a prebuilt index + markdown files that ROG-STRIX pushes into the app's own external-files folder. A bash harness in `device/` drives the real tablet over adb.

**Tech Stack:** React Native 0.82 / TypeScript 5 / Jest; Kotlin + Shizuku API 13.1.5; Node 22.21.0 + Yarn 1.22.22; Android SDK/NDK 27.3 on ROG-STRIX; adb via `~/projects/galaxy-tab-s7/tablet`.

**Spec:** `docs/superpowers/specs/2026-10-19-pocketpal-bray-design.md`

## Global Constraints

- applicationId `com.pocketpalai.bray`; app label `PocketPal Bray`; namespace stays `com.pocketpal`.
- Release keystore lives at `~/.config/pocketpal-bray/release.keystore`, passwords in `~/.config/pocketpal-bray/signing.env` (chmod 600). Never committed.
- Tablet adb target: whatever `~/projects/galaxy-tab-s7/tablet status` reports (LAN `192.168.1.8:<port>` or `localhost:5599`). Never hard-code.
- Never send a command that can disable Wi-Fi or reboot the tablet.
- Tool results fed to the model: max **1,200 characters** (`MAX_TOOL_CHARS = 1200`), so they fit `n_ctx=2048`.
- Tools that change or delete anything must show an Allow/Deny dialog; on Deny return `{type:'error', summary:'Bo declined: <action>'}`.
- New code in new files under `src/services/talents/bray/`, `src/specs/NativeShizukuShell.ts`, `android/app/src/main/java/com/pocketpalai/shizuku/`, `device/`, `scripts/bray/`. Upstream files touched: only those named in a task's **Modify** list.

## Review Focus

- **Shizuku not running** (after a tablet reboot it stops): every tablet tool must return a plain-English error "Shizuku isn't running — open Shizuku and tap Start", never crash. Test in Task B2.
- **Permission not yet granted**: first call must trigger Shizuku's permission dialog, not fail silently. Test in Task B1 device check.
- **Model invents arguments** (e.g. brightness `"high"`, app name with typos): tools validate and coerce, returning a helpful error the model can recover from. Tests in B2/B3.
- **Huge output** (`ls` of a big folder, long note): truncated to `MAX_TOOL_CHARS` with "…(truncated)". Tests in B4 and C2.
- **Notes copy missing or stale** (never synced, or SD card removed): `search_notes` answers "Your notes aren't on the tablet yet" instead of throwing. Test in C2.

---

## Part A — Foundation (do first; B and C start after A3)

### Task A1: Bray build config and signed release APK

**Files:**
- Modify: `android/app/build.gradle` (defaultConfig `applicationId`, `signingConfigs.release` keystore path → env `BRAY_KEYSTORE`)
- Modify: `android/app/src/main/res/values/strings.xml` (`app_name` → `PocketPal Bray`)
- Create: `android/app/google-services.json` (copy of upstream CI dummy, `package_name` entries `com.pocketpalai.bray` and `com.pocketpalai.bray.e2e`)
- Create: `scripts/bray/build-release.sh`
- Create: `.nvmrc` unchanged; install Node 22.21.0 via nvm on ROG-STRIX if absent

**Interfaces:**
- Produces: `scripts/bray/build-release.sh` → prints the absolute path of a signed `app-prod-release.apk` on its last line; exit 0 on success.

- [ ] **Step 1:** Generate keystore: `keytool -genkeypair -v -keystore ~/.config/pocketpal-bray/release.keystore -alias bray -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Bo Bray, OU=PocketPal Bray"`; write `BRAY_STORE_PASS`/`BRAY_KEY_PASS` to `signing.env`, chmod 600.
- [ ] **Step 2:** Write `build-release.sh`: sources nvm (Node 22.21.0), `signing.env`; runs `yarn install --frozen-lockfile`, `cd android && ./gradlew assembleProdRelease`; echoes the APK path.
- [ ] **Step 3:** Run it. Expected: exit 0, APK exists.
- [ ] **Step 4:** Verify: `aapt2 dump badging <apk> | grep -E "^package|application-label|native-code"` → `name='com.pocketpalai.bray'`, label `PocketPal Bray`, `arm64-v8a` present. `apksigner verify --print-certs <apk>` → `CN=Bo Bray`.
- [ ] **Step 5:** `yarn test src/services/talents` → all pass (upstream baseline).
- [ ] **Step 6:** Commit `chore(bray): package id, label, signing, dummy firebase config`.

### Task A2: Device harness

**Files:**
- Create: `device/lib.sh`, `device/install.sh`, `device/chat.sh`, `device/shot.sh`, `device/README.md`

**Interfaces:**
- Produces (bash functions in `device/lib.sh`): `dev_target` (echo adb serial via `tablet status`), `dev_ready` (exit 1 unless `mWakefulness=Awake` and `isKeyguardShowing=false`), `dev_ui_text` (uiautomator text+content-desc lines), `dev_tap_text <regex>`, `dev_shot <out.png>` (screencap, resized to ≤2000 px), `dev_free_ram_mb`. Every function that touches the tablet runs under `flock /tmp/bray-device.lock` so parallel agents never drive the screen at the same time.
- Produces: `device/install.sh <apk>` → installs, asserts `primaryCpuAbi=arm64-v8a` and package `com.pocketpalai.bray`.
- Produces: `device/chat.sh "<prompt>" [--pal "<name>"] [--timeout 180]` → prints JSON one line: `{"prompt","response","tok_s","ttft_ms","tools_used":[...],"screenshot":"<path>","ok":bool}`. Reads the metrics line `NNNms/token, X tokens/sec, NNNNms TTFT` and tool chips from the UI dump.
- Produces: `device/shot.sh "<caption>"` → screenshot posted with `~/bin/mm-post-image --channel galaxy-tab-s7`.

- [ ] **Step 1:** Implement `lib.sh` + `install.sh`; run `device/install.sh $(scripts/bray/build-release.sh | tail -1)`. Expected: "installed com.pocketpalai.bray arm64-v8a".
- [ ] **Step 2:** On the tablet, load Gemma **from the SD card** (Bo's rule: big files on microSD): push `gemma-4-E2B-it-Q4_0.gguf` + `mmproj-gemma-4-E2B-it-Q8_0.gguf` (downloaded on ROG from `ggml-org/gemma-4-E2B-it-GGUF`) to `/storage/6238-3662/AI-Models/`, add via **Models → + → Add Local Model**. Verify with `du` that internal storage did not grow by ~3 GB (if Add Local Model copies the file internally, record that and keep the copy only in one place). Screenshot shows the model card and a successful chat.
- [ ] **Step 3:** Implement `chat.sh`; run `device/chat.sh "What is 17 times 23?"`. Expected JSON with `ok:true`, `tok_s` ≥ 5, response contains `391`.
- [ ] **Step 4:** `device/shot.sh "A2: Bray build chatting on tablet"` → image appears in Mattermost channel `galaxy-tab-s7`.
- [ ] **Step 5:** Commit `test(bray): on-device harness`.

### Task A3: Eval suite and results log

**Files:**
- Create: `device/evals/cases.jsonl`, `device/run-evals.sh`, `docs/eval-results.md`

**Interfaces:**
- `cases.jsonl` line: `{"id","prompt","pal","expect_tool":string|null,"expect_regex":string,"offline":bool,"needs_approval":bool}`.
- `device/run-evals.sh [--only <id-prefix>] [--offline]` → runs each case via `chat.sh`, appends a dated table row per case to `docs/eval-results.md`, prints `PASS n/m`; exit 1 if pass rate < 80 %.

- [ ] **Step 1:** Seed 4 baseline chat cases (`base-*`: arithmetic, short factual, summary of a pasted paragraph, follow-up turn). B and C tasks append their own cases.
- [ ] **Step 2:** Run `device/run-evals.sh --only base`. Expected `PASS 4/4`, rows in `docs/eval-results.md`.
- [ ] **Step 3:** Commit `test(bray): eval suite + results log`.

---

## Part B — Tablet tools (parallel agent 1, own worktree)

### Task B1: ShizukuShell native module

**Files:**
- Create: `src/specs/NativeShizukuShell.ts`
- Create: `android/app/src/main/java/com/pocketpalai/shizuku/ShizukuShellModule.kt`, `ShizukuShellPackage.kt`, `ShellUserService.kt`
- Create: `android/app/src/main/aidl/com/pocketpalai/shizuku/IShellService.aidl`
- Modify: `android/app/build.gradle` (deps `dev.rikka.shizuku:api:13.1.5`, `dev.rikka.shizuku:provider:13.1.5`; `buildFeatures { aidl true }`), `android/app/src/main/AndroidManifest.xml` (`rikka.shizuku.ShizukuProvider`, authority `${applicationId}.shizuku`), `MainApplication.kt` (add package)

**Interfaces:**
- Produces (TS, `NativeShizukuShell`): `isRunning(): Promise<boolean>`, `hasPermission(): Promise<boolean>`, `requestPermission(): Promise<boolean>`, `exec(command: string, timeoutMs: number): Promise<string>` where the string is JSON `{"exitCode":number,"stdout":string,"stderr":string,"timedOut":boolean}`.
- AIDL: `String exec(String command, long timeoutMs);` runs `sh -c command` as shell uid inside the UserService.

- [ ] **Step 1:** Write `src/services/talents/bray/__tests__/shell.test.ts` against a jest mock of the module: `runShell('echo hi')` → `{exitCode:0, stdout:'hi\n'}`; when `isRunning()` is false → throws `ShizukuNotRunningError`.
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement Kotlin module (bind UserService with `Shizuku.bindUserService`, 10 s bind timeout) and `src/services/talents/bray/shell.ts` exporting `runShell(cmd: string, timeoutMs = 8000): Promise<ShellResult>` and `class ShizukuNotRunningError`.
- [ ] **Step 4:** Unit tests PASS; build + install.
- [ ] **Step 5 (device):** Install; app launches with no crash (`logcat` has no `FATAL EXCEPTION` for `com.pocketpalai.bray`). The first real native call happens in B2, whose device step must show Shizuku's permission prompt, tap **Allow all the time**, and screenshot it.
- [ ] **Step 6:** Commit `feat(bray): ShizukuShell native module`.

### Task B2: `tablet_status` (read-only)

**Files:** Create `src/services/talents/bray/TabletStatusEngine.ts`, test `__tests__/TabletStatusEngine.test.ts`; Modify `src/services/talents/index.ts` (register B2–B5 engines).

**Interfaces:** Consumes `runShell`. Produces talent name `tablet_status`, no args. Summary format (single line per item): `Battery 74% (charging) · Wi-Fi BrayFarm · Storage free 121 GB · RAM free 2.8 GB · Brightness 97%`.

- [ ] **Step 1:** Tests: parses fixture outputs of `dumpsys battery`, `dumpsys wifi | grep mWifiInfo`, `df /data`, `/proc/meminfo`, `settings get system screen_brightness` into the exact summary above; `ShizukuNotRunningError` → `{type:'error', summary:"Shizuku isn't running — open Shizuku and tap Start"}`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5 (device):** Create Pal "Tablet Pal" with talents `tablet_*`; `device/chat.sh "How much battery do I have?" --pal "Tablet Pal"` → `tools_used` contains `tablet_status`, response percentage equals `dumpsys battery` level read by the harness. Screenshot.
- [ ] **Step 6:** Add eval cases `tab-status-*` (3). Commit.

### Task B3: `tablet_set_brightness` and `tablet_open_app` (change → approval)

**Files:** Create `TabletBrightnessEngine.ts`, `TabletOpenAppEngine.ts`, `src/services/talents/bray/approval.ts`, tests.

**Interfaces:**
- `approval.ts`: `askApproval(title: string, detail: string): Promise<boolean>` (RN `Alert.alert` with **Deny** / **Allow**).
- `tablet_set_brightness({level:number})`: coerces strings (`"50%"`→50, `"max"`→100, `"low"`→20); clamps 0–100; maps to 0–255; runs `settings put system screen_brightness_mode 0; settings put system screen_brightness N` after approval.
- `tablet_open_app({name:string})`: resolves against `cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER` labels, case-insensitive, then closest match (Levenshtein ≤ 3); launches with `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`. Opening an app is **not** destructive → no approval.

- [ ] **Step 1:** Tests: coercion table; Deny → error `Bo declined: set brightness to 50%`; `"libretub"` resolves to `com.github.libretube`; unknown app → error listing 3 nearest labels.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5 (device):** `chat.sh "Set my brightness to 40%"` → harness sees Allow/Deny dialog in UI dump, taps **Allow**, then `settings get system screen_brightness` = 102. `chat.sh "Open LibreTube"` → focused window `com.github.libretube`. Restore brightness afterwards. Screenshots.
- [ ] **Step 6:** Eval cases `tab-bright-*`, `tab-open-*` (with `needs_approval`). Commit.

### Task B4: `tablet_list_files` (read-only) and `tablet_shell` (approval)

**Files:** Create `TabletListFilesEngine.ts`, `TabletShellEngine.ts`, tests.

**Interfaces:**
- `tablet_list_files({path?:string})`: default `/sdcard/Download`; only paths under `/sdcard/` or `/storage/` (else error); `ls -la`, newest first, truncated to `MAX_TOOL_CHARS`.
- `tablet_shell({command:string})`: always asks approval showing the exact command; blocklist regex rejects without asking: `svc wifi|cmd wifi|reboot|settings put global airplane|pm uninstall|rm -rf /`.

- [ ] **Step 1:** Tests: path guard; truncation marker `…(truncated)`; blocklist rejects `svc wifi disable` with error `Blocked: this could cut the tablet off the network`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5 (device):** `chat.sh "What's in my downloads folder?"` → lists real files (compare to `adb shell ls /sdcard/Download`). `chat.sh "Run uptime"` → dialog → Allow → output matches. `chat.sh "Turn off wifi"` → no dialog, refusal text. Screenshots.
- [ ] **Step 6:** Eval cases `tab-files-*`, `tab-shell-*`. Commit.

---

## Part C — Notes tools (parallel agent 2, own worktree)

### Task C1: Notes export + push job (ROG-STRIX)

**Files:** Create `scripts/bray/notes_index.py`, `scripts/bray/push-notes.sh`, test `scripts/bray/test_notes_index.py`.

**Interfaces:**
- `notes_index.py <mirror_dir> <out_dir>` → writes `out_dir/notes/<id>.md` (frontmatter stripped, `_JopSync Archive` and `Bo Notes/Web Crawling` excluded) and `out_dir/index.json`: `{"version":1,"built":"ISO8601","notes":[{"id","title","folder","chars"}],"terms":{"<term>":[[noteIdx,count],...]}}`; terms lowercased, len ≥ 3, stop-words removed, terms in > 400 notes dropped; title words weighted ×5.
- `push-notes.sh` → builds into `/tmp/bray-notes`, `adb push --sync` to `/sdcard/Android/data/com.pocketpalai.bray/files/notes-db/` on the current tablet target; prints `pushed N notes`.

- [ ] **Step 1:** pytest: 3 fixture notes → index contains expected terms/weights; archive folder excluded.
- [ ] **Step 2–4:** FAIL → implement → PASS (`python3 -m pytest scripts/bray`).
- [ ] **Step 5 (device):** run `push-notes.sh` → `adb shell ls .../notes-db/notes | wc -l` ≈ count printed.
- [ ] **Step 6:** Commit. (Scheduling: systemd user timer on ROG every 6 h when tablet reachable — Task C3.)

### Task C2: `search_notes` and `read_note` talents

**Files:** Create `src/services/talents/bray/NotesStore.ts`, `SearchNotesEngine.ts`, `ReadNoteEngine.ts`, tests.

**Interfaces:**
- `NotesStore.load(): Promise<NotesIndex | null>` reads `${RNFS.ExternalDirectoryPath}/notes-db/index.json` once (cached).
- `search_notes({query:string})` → top 5 by summed term weight: `1. <title> (<folder>) [id: <id>]` + first 120 chars; missing index → `Your notes aren't on the tablet yet — ask Claude to sync them.`
- `read_note({id:string} | {title:string})` → note body truncated to `MAX_TOOL_CHARS`; title lookup case-insensitive exact, then best search hit.

- [ ] **Step 1:** Tests with an in-memory fixture index: query "batting cage" ranks the batting-cage note first; missing index message exact; read by title works; truncation marker.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5 (device):** Pal "Notes Pal" with `search_notes`, `read_note`. `chat.sh "What do my notes say about the batting cage plug?" --pal "Notes Pal"` → `tools_used` includes `search_notes`; response mentions `ZEN14` (from the HA devices note). Screenshot.
- [ ] **Step 6:** Eval cases `notes-*` (5, three with `offline:true`). Commit.

### Task C3: Keep notes fresh

**Files:** Create `scripts/bray/systemd/bray-notes-push.service`, `.timer` (every 6 h, `OnUnitActiveSec=6h`), install into `~/.config/systemd/user/`.

- [ ] **Step 1:** Enable timer; `systemctl --user list-timers | grep bray-notes` shows next run.
- [ ] **Step 2:** Edit a test note in Joplin → wait for mirror → `systemctl --user start bray-notes-push` → `chat.sh "search my notes for <unique word>"` finds it. Commit.

---

## Part E — Integration, release, constant improvement (after B and C merge)

### Task E1: One "Bray" Pal with all tools + release

- [ ] Seed Pal **"Bray"** (all `tablet_*` + notes talents, system prompt: "You are Bo's offline tablet assistant. Use a tool when the question is about this tablet or Bo's notes; otherwise answer directly. Keep answers short.") on first launch via `palStore.createPal` guarded by AsyncStorage key `bray.seeded.v1`.
- [ ] Full `device/run-evals.sh` → ≥ 80 %; Bo runs the `--offline` subset with airplane mode on; harness reads results after.
- [ ] Create GitHub repo `BallParkBanter/pocketpal-bray` + Gitea mirror; `gh release create v1.20.1-bray.1 <apk>`; add to Obtainium on the tablet (filter `app-prod-release`); verify install on screen.
- [ ] Docs: Joplin note (Infrastructure/Computers/Galaxy Tab S7) "PocketPal Bray — offline tablet assistant", App Sources row, As-Built row.

### Task E2: Improvement loop (ongoing)

- Weekly: `git fetch upstream && git merge upstream/main` → build → full evals; ship only if pass rate ≥ last release.
- Every failed eval case gets a fix (tool description, coercion, or system prompt) **and** stays in `cases.jsonl` as a regression test.
- Try newer small models (e.g. Qwen3.5 4B, LFM2.5-2.6B) by running the same suite; switch default only when its score beats Gemma 4 E2B on this tablet.

## Part D — MCP client (parallel agent 3, own worktree)

### Task D1: MCP talent bridge

**Files:** Create `src/services/talents/bray/mcp/McpClient.ts`, `McpTalentEngine.ts`, `McpServerStore.ts`, tests; Modify `package.json` (dep `@modelcontextprotocol/sdk`, Streamable HTTP transport only).

**Interfaces:**
- `McpServerStore`: list of `{name, url, headers?, enabled}` persisted in AsyncStorage key `bray.mcp.servers.v1`.
- On app start and on server change: for each enabled server, `listTools()`; register one `McpTalentEngine` per tool, talent name `mcp_<server>_<tool>` (≤ 64 chars, `[a-z0-9_]`). Unreachable server → its talents return `"<server> isn't reachable right now (offline?)"`; app never blocks on it.
- Tool results stringified and truncated to `MAX_TOOL_CHARS`.

- [ ] **Step 1:** Tests against an in-process fake MCP server: tools discovered and named correctly; call round-trips; unreachable server message exact.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5 (device):** Add Bo's Joplin MCP (`http://192.168.1.50:9095/mcp`) in a simple settings screen (`McpServersScreen`, list + add/remove). `chat.sh "Search my Joplin for Tempus" --pal "Bray"` while online → `tools_used` includes `mcp_joplin_search_notes`, answer names the Tablet Music note. With airplane mode on (Bo), same question → falls back to `search_notes` (offline copy). Screenshots.
- [ ] **Step 6:** Eval cases `mcp-*`. Commit.

## Reporting rule

Nothing is reported to Bo as working until it has been seen working **on the tablet screen** (screenshot posted to `galaxy-tab-s7`). Short messages; say what was verified and what was not.

## Parallel execution

A1 → A2 → A3 sequential (one agent). Then **three agents in separate git worktrees**: Agent 1 = Part B, Agent 2 = Part C, Agent 3 = Part D. They touch disjoint files except one line each in `src/services/talents/index.ts` (merge trivially). The tablet is shared: device steps acquire `flock /tmp/bray-device.lock` inside `device/lib.sh` so only one agent drives it at a time. Merge B and C, then E1.
