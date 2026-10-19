# PocketPal Bray — Design

**Date:** 2026-10-19 · **Owner:** Bo · **Device:** Galaxy Tab S7 (SM-T870, LineageOS 23.2 / Android 16, not rooted)

## Why

Bo wants **one offline app** on the tablet that he can chat with when nothing else
has power or internet, and that can (1) read his notes and (2) *do things on the
tablet* the way Claude does over adb. Stock PocketPal AI already does offline chat
well (Gemma 4 E2B Q4_0 measured on this tablet: 9.15 tok/s, 1.5 s to first token)
and has a clean tool ("Talent") plug-in system. Rather than wait for an app that
does everything, we fork PocketPal (MIT) and add the missing tools.

## What it is

A fork of `a-ghorbani/pocketpal-ai` named **PocketPal Bray**, package
`com.pocketpalai.bray`, installed **alongside** stock PocketPal, distributed from
Bo's own GitHub/Gitea releases so Obtainium updates it.

## Facts this design rests on (verified 2026-10-19)

- Talents are classes implementing `TalentEngine` (`src/services/talents/types.ts`):
  `name`, `execute(args, ctx) → TalentResult`, `toToolDefinition()` (OpenAI
  function schema), optional `systemPromptFragment()`. Registered in
  `registerDefaultTalents()` (`src/services/talents/index.ts`). The Pal editor's
  `TalentSection` lists every registered talent automatically. A Pal enables
  talents via `pal.pact.talents: {name, necessity}[]`.
- Native code uses TurboModules: spec in `src/specs/Native*.ts`, codegen package
  `com.pocketpal.specs`, Kotlin modules in
  `android/app/src/main/java/com/pocketpalai/`, registered in `MainApplication.kt`.
- Upstream CI builds with a **dummy `google-services.json`** — Firebase is only used
  for optional benchmark upload (`src/utils/fb.ts`) and PalsHub sign-in.
- **Shizuku 13.6.0 is installed and its server is running** on the tablet
  (`shizuku_server`, uid shell). Shizuku gives an app shell-uid command execution
  without root — the same power Claude uses over adb.
- Joplin's notes on the tablet are in Joplin's private storage; no other app (and
  not adb) can read them. A plain-markdown mirror of the whole KB (4,591 notes,
  63 MB) already exists at `ROG-STRIX:~/projects/joplin-mirror`.
- Default context is `n_ctx=2048`; tool results must be budgeted.
- Reddit consensus + our own reading: ~2B models are unreliable at multi-step
  tool use. Design for **narrow, single-purpose tools** that a small model can
  call correctly in one step.

## Components

| # | Component | Purpose |
|---|---|---|
| A | Fork + build + device test harness | Reproducible signed build; install, drive the UI, read results, screenshot, post to Mattermost |
| B | Tablet tools (Shizuku) | `tablet_status`, `tablet_set_brightness`, `tablet_open_app`, `tablet_list_files`, `tablet_shell` (asks Bo first) |
| C | Notes tools | `search_notes`, `read_note` over a mirror copy pushed to the app's own folder on the SD card |
| D | MCP client (later plan) | Connect to MCP servers (offline on-tablet ones; Bo's Joplin/HA servers when online) |
| E | Eval loop | Fixed prompt suite run on the real tablet after every change; results logged; regressions block release |

## Rules

- **Validate on the real tablet screen** before claiming anything works. Every task
  that touches the app ends with an on-device check (screenshot + UI text).
- **Anything that changes or deletes asks Bo first** (in-app Allow/Deny dialog).
  Read-only tools run without asking.
- Never run a command that can cut the tablet's Wi-Fi (it is the only way in).
- Stock PocketPal stays installed and untouched.
- Keep upstream mergeable: additions in new files; edits to upstream files are
  small and listed in the plan.

## Success criteria

1. PocketPal Bray installs from a GitHub release via Obtainium and opens offline.
2. With Gemma 4 E2B, the eval suite (section E) passes ≥ 80 % on the tablet, with
   Wi-Fi off for the offline cases (Bo toggles airplane mode; the harness reads
   the results afterwards).
3. A destructive request ("delete my downloads") shows the Allow/Deny dialog and
   does nothing on Deny.
