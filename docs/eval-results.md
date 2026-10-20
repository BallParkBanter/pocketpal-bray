# Eval results

Appended by `device/run-evals.sh`. Cases live in `device/evals/cases.jsonl`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-19 10:57 | base-arithmetic | PASS | 9.04 | 968 | - | 391 |
| 2026-10-19 10:58 | base-factual | PASS | 9.37 | 839 | - | The capital of France is Paris. |
| 2026-10-19 11:00 | base-summary | PASS | 9.46 | 2180 | - | The Mississippi River, the second-longest in North America, flows from Lake Ita... |
| 2026-10-19 11:02 | base-followup | PASS | 6.1 | 1689 | - | Teal |
| 2026-10-19 11:08 | base-followup | PASS | 5.31 | 2229 | - | Teal |
| 2026-10-19 12:46 | mcp-joplin-search | PASS | 8.44 | 27450 | mcp_joplin_search_notes | I found 6 notes containing the term "Tempus". Here are the titles and snippets:... |
| 2026-10-19 12:49 | mcp-joplin-navidrome | PASS | 8.6 | 28684 | mcp_joplin_search_notes | The note titles I found related to "Navidrome" are: 1. 🎵 Feishin — Web Music Pl... |
| 2026-10-19 14:28 | notes-batting-cage | FAIL | - | - | - | model not loaded (released twice) |
| 2026-10-19 14:29 | notes-ac-filter | FAIL | - | - | - | pal not found: Notes Pal |
| 2026-10-19 14:30 | notes-telluride-lx | FAIL | - | - | - | pal not found: Notes Pal |
| 2026-10-19 14:44 | notes-batting-cage | FAIL | 8.13 | 48380 | search_notes,read_note | Your notes indicate that there are entities related to a "Batting Cage Plug" in... |
| 2026-10-19 14:47 | notes-ac-filter | PASS | 8.75 | 28834 | search_notes,read_note | The size of the AC filter is 18 x 20 x 1. |
| 2026-10-19 14:49 | notes-telluride-lx | PASS | 7.94 | 68761 | search_notes,read_note | The starting price for the base LX trim of the Kia Telluride is approximately $... |
| 2026-10-19 14:52 | notes-air-return | PASS | 8.9 | 29247 | search_notes,read_note | The air return size for the master bathroom is 11.5 x 7.75. |
| 2026-10-19 14:55 | notes-read-by-title | PASS | 8.4 | 46020 | search_notes,read_note | The approximate starting price for the Kia Telluride S trim is $39,390. |
| 2026-10-19 15:12 | notes-batting-cage | FAIL | 8.13 | 48413 | search_notes,read_note | Your notes show that there are entities related to a "Batting Cage Plug" in the... |
| 2026-10-19 15:23 | notes-batting-cage | PASS | 8.27 | 48413 | search_notes,read_note | Your notes mention a Batting Cage (Outdoor) device, which is a Zooz Outdoor Dou... |
| 2026-10-19 15:26 | notes-ac-filter | PASS | 8.91 | 28958 | search_notes,read_note | The AC filter size is 18 x 20 x 1. |
| 2026-10-19 15:28 | notes-telluride-lx | PASS | 8.31 | 44567 | search_notes,read_note | The starting price for the base LX trim of the Kia Telluride is approximately $... |
| 2026-10-19 15:31 | notes-air-return | PASS | 8.81 | 29263 | search_notes,read_note | The notes indicate the air return size for the master bathroom is 11.5 x 7.75. |
| 2026-10-19 15:34 | notes-read-by-title | PASS | 8.12 | 47253 | search_notes,read_note | The approximate price for the Kia Telluride S trim is $39,390. |
| 2026-10-19 15:43 | tab-status-battery | PASS | 9.03 | 17509 | tablet_status | The battery level is 40% and it is not currently charging. |
| 2026-10-19 15:46 | tab-status-wifi | PASS | 9.29 | 17796 | tablet_status | The tablet is currently connected to the Wi-Fi network named "Conference Center... |
| 2026-10-19 15:48 | tab-status-storage | PASS | 8.86 | 17596 | tablet_status | The tablet has 114 GB of free storage space. |
| 2026-10-19 15:51 | tab-bright-40 | PASS | 9.1 | 20876 | tablet_set_brightness | The screen brightness has been set to 40%. |
| 2026-10-19 15:53 | tab-bright-max | PASS | 0.0 | - | tablet_set_brightness | Done: the screen brightness is now 100% (it was 40%). Auto-brightness is off. |
| 2026-10-19 15:56 | tab-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 16:00 | tab-open-typo | FAIL | - | - | - | timed out after 180s waiting for the reply |
| 2026-10-19 16:05 | tab-files-downloads | PASS | 8.92 | 9369 | tablet_list_files | The downloads folder contains the following files and folders, with the newest ... |
| 2026-10-19 16:06 | tab-files-sdcard-models | PASS | 8.73 | 22399 | tablet_list_files | I found two files in that directory: 2026-10-19 10:11 531.5 MB mmproj-gemma-4-E... |
| 2026-10-19 16:09 | tab-shell-uptime | PASS | 9.26 | 21480 | tablet_shell | The system uptime is 15 days, 20 hours, and 39 minutes, with 0 users and a load... |
| 2026-10-19 16:11 | tab-shell-wifi-blocked | PASS | 8.85 | 17397 | tablet_shell | Bo, I attempted to turn off the Wi-Fi using a shell command, but the system blo... |
| 2026-10-19 16:15 | tab-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 16:17 | tab-open-typo | PASS | 7.76 | 20738 | tablet_open_app | The LibreTube app has been opened. |
| 2026-10-19 16:44 | base-arithmetic | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 16:45 | base-factual | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 16:46 | base-summary | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 16:46 | base-followup | FAIL | - | - | - | setup failed: pal still active after choosing No Pal |
| 2026-10-19 16:47 | mcp-joplin-search | FAIL | - | - | - | pal not selected: MCP Pal |
| 2026-10-19 16:48 | mcp-joplin-navidrome | FAIL | 7.76 | 20738 | tablet_open_app | The LibreTube app has been opened. |
| 2026-10-19 16:52 | notes-batting-cage | FAIL | 7.76 | 20738 | tablet_open_app | The LibreTube app has been opened. |
| 2026-10-19 16:53 | notes-ac-filter | PASS | 8.54 | 33211 | search_notes,read_note | The size of the AC filter is 18 x 20 x 1. |
| 2026-10-19 16:55 | notes-telluride-lx | PASS | 7.86 | 46054 | search_notes,read_note | The starting price of the base LX trim of the 2025 Kia Telluride is approximate... |
| 2026-10-19 16:58 | notes-air-return | PASS | 7.98 | 31769 | search_notes,read_note | The air return size for the master bathroom is 11.5 x 7.75. |
| 2026-10-19 17:01 | notes-read-by-title | PASS | 7.7 | 49317 | search_notes,read_note | The approximate price for the S trim of the Kia Telluride is $39,390. |
| 2026-10-19 17:04 | tab-status-battery | FAIL | - | - | - | pal not selected: Tablet Pal |
| 2026-10-19 17:05 | tab-status-wifi | FAIL | - | - | - | pal not found: Tablet Pal |
| 2026-10-19 17:06 | tab-status-storage | FAIL | - | - | - | pal not selected: Tablet Pal |
| 2026-10-19 17:07 | tab-bright-40 | FAIL | - | - | - | pal not found: Tablet Pal |
| 2026-10-19 17:17 | base-arithmetic | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 17:19 | base-factual | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 17:20 | base-summary | FAIL | - | - | - | pal still active after choosing No Pal |
| 2026-10-19 17:21 | base-followup | FAIL | - | - | - | setup failed: pal still active after choosing No Pal |
| 2026-10-19 17:22 | mcp-joplin-search | FAIL | - | - | - | pal not selected: MCP Pal |
| 2026-10-19 17:24 | mcp-joplin-navidrome | FAIL | - | - | - | pal not found: MCP Pal |
| 2026-10-19 17:25 | notes-batting-cage | FAIL | - | - | - | pal not found: Notes Pal |
| 2026-10-19 17:27 | notes-ac-filter | PASS | 8.34 | 30837 | search_notes,read_note | The size of the AC filter is 18 x 20 x 1. |

> 2026-10-19 16:44–17:27: two full runs stopped early. The Pal-picking harness bug (fixed in ebbb656e: the backdrop tap landed on the Lookie row; rows clipped under the tab bar) caused every "pal …" FAIL above; those are harness failures, not model failures. The 16:48/16:52 rows show a stale reply from an earlier chat. The tablet then locked (unplugged, asleep) at ~17:55, so the full run after the fix has not been done yet.
| 2026-10-19 20:12 | base-arithmetic | PASS | 8.68 | 908 | - | 391 |
| 2026-10-19 20:14 | base-factual | PASS | 9.11 | 814 | - | The capital of France is Paris. |
| 2026-10-19 20:16 | base-summary | PASS | 9.66 | 2130 | - | The Mississippi River is the second-longest river in North America, flowing fro... |
| 2026-10-19 20:18 | base-followup | PASS | 8.89 | 1776 | - | Teal |
| 2026-10-19 20:22 | mcp-joplin-search | PASS | 8.39 | 28071 | mcp_joplin_search_notes | I found 3 notes that mention "Tempus": 1. 🎵 Tablet Music Offline — Tempus + the... |
| 2026-10-19 20:25 | mcp-joplin-navidrome | PASS | 8.7 | 28893 | mcp_joplin_search_notes | The following note titles related to "Navidrome" were found: 1. 🎵 Feishin — Web... |
| 2026-10-19 20:28 | notes-batting-cage | PASS | 8.37 | 42575 | search_notes,read_note | Your notes indicate that the Batting Cage (Outdoor) is controlled by a Zooz Out... |
| 2026-10-19 20:32 | notes-ac-filter | PASS | 9.16 | 28969 | search_notes,read_note | The AC filter size is 18 x 20 x 1. |
| 2026-10-19 20:35 | notes-telluride-lx | PASS | 8.64 | 43871 | search_notes,read_note | The starting price for the base LX trim of the 2025 Kia Telluride is approximat... |
| 2026-10-19 20:38 | notes-air-return | PASS | 8.78 | 29239 | search_notes,read_note | The air return size for the master bathroom is 11.5 x 7.75. |
| 2026-10-19 20:41 | notes-read-by-title | PASS | 8.49 | 46183 | search_notes,read_note | The approximate starting price for the S trim of the Kia Telluride is $39,390. |
| 2026-10-19 20:44 | tab-status-battery | PASS | 8.79 | 17568 | tablet_status | I found that the battery level is 69% and it is not currently charging. |
| 2026-10-19 20:47 | tab-status-wifi | PASS | 9.13 | 18031 | tablet_status | The tablet is connected to the Wi-Fi network "NomadicNetwork". |
| 2026-10-19 20:50 | tab-status-storage | PASS | 9.04 | 17781 | tablet_status | The tablet has 114 GB of free storage space. |
| 2026-10-19 21:00 | tab-bright-40 | PASS | 9.23 | 67059 | tablet_set_brightness | The screen brightness has been set to 40%. |
| 2026-10-19 21:17 | tab-bright-max | PASS | 8.94 | 22272 | tablet_set_brightness | The screen brightness has been turned up to 100%. |
| 2026-10-19 21:30 | tab-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 21:33 | tab-open-typo | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 21:37 | tab-files-downloads | PASS | 8.86 | 23989 | tablet_list_files | The files in your downloads folder are: 2026-10-15 01:18 2.4 MB Sd54f5ab8ce834c... |
| 2026-10-19 21:48 | tab-files-sdcard-models | PASS | 9.04 | 22542 | tablet_list_files | I found two files in the /storage/6238-3662/AI-Models directory: mmproj-gemma-4... |
| 2026-10-19 21:55 | tab-shell-uptime | PASS | 9.21 | 22331 | tablet_shell | The tablet is up for 16 days, with a load average of 0.00. |
| 2026-10-19 21:58 | tab-shell-wifi-blocked | PASS | 9.32 | 17232 | tablet_shell | I was unable to turn off the Wi-Fi because the system blocked the command, as i... |
| 2026-10-19 22:01 | bray-battery | PASS | 8.7 | 23298 | tablet_status | You have 46% battery and the tablet is not currently charging. |
| 2026-10-19 22:04 | bray-bright-40 | PASS | 9.06 | 30195 | tablet_set_brightness | The screen brightness is now set to 40%. |
| 2026-10-19 22:07 | bray-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 22:47 | base-arithmetic | PASS | 6.98 | 43817 | - | 391 |
| 2026-10-19 22:49 | base-factual | PASS | 8.87 | 19766 | - | Paris is the capital of France. |
| 2026-10-19 22:51 | base-summary | PASS | 8.88 | 21421 | - | The Mississippi River is the second-longest river in North America, flowing fro... |
| 2026-10-19 22:53 | base-followup | PASS | 6.82 | 21479 | - | Teal |
| 2026-10-19 22:57 | notes-batting-cage | FAIL | 7.88 | 37031 | search_notes | I found a few notes mentioning "batting cage plug." The most relevant ones are ... |
| 2026-10-19 23:00 | notes-ac-filter | PASS | 8.68 | 38583 | search_notes | The AC filter size is 18 x 20 x 1. |
| 2026-10-19 23:02 | notes-telluride-lx | PASS | 8.31 | 61095 | search_notes,read_note | The starting price for the base LX trim of the Kia Telluride is approximately $... |
| 2026-10-19 23:05 | notes-air-return | PASS | 8.68 | 38533 | search_notes | I found two notes that might be relevant. The first note mentions "Master bathr... |
| 2026-10-19 23:07 | notes-read-by-title | PASS | 7.84 | 64113 | search_notes,read_note | The S trim of the Kia Telluride is approximately $39,390. |
| 2026-10-19 23:10 | tab-status-battery | PASS | 8.8 | 23279 | tablet_status | You have 19% battery and it is not currently charging. |
| 2026-10-19 23:12 | tab-status-wifi | PASS | 8.77 | 23301 | tablet_status | The tablet is currently connected to the Wi-Fi network NomadicNetwork. |
| 2026-10-19 23:14 | tab-status-storage | PASS | 9.36 | 23561 | tablet_status | You have 114 GB of free storage space on the tablet. |
| 2026-10-19 23:16 | tab-bright-40 | PASS | 0.0 | - | tablet_set_brightness | Done: the screen brightness is now 40% (it was 100%). Auto-brightness is off. |
| 2026-10-19 23:18 | tab-bright-max | PASS | 9.1 | 28184 | tablet_set_brightness | The screen brightness has been turned up to 100%. |
| 2026-10-19 23:21 | tab-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 23:23 | tab-open-typo | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-19 23:25 | tab-files-downloads | PASS | 8.06 | 31766 | tablet_list_files | I found the following files and folders in your downloads folder: a PDF, a fold... |
| 2026-10-19 23:27 | tab-files-sdcard-models | PASS | 8.25 | 29996 | tablet_list_files | I found two files in that directory: mmproj-gemma-4-E2B-it-Q8_0.gguf (531.5 MB)... |
| 2026-10-19 23:30 | tab-shell-uptime | PASS | 8.57 | 28569 | tablet_shell | The tablet is up for 16 days, 3 hours, and 59 minutes, with a load average of 0... |
| 2026-10-19 23:32 | tab-shell-wifi-blocked | PASS | 7.43 | 23738 | tablet_shell | Bo declined. I cannot turn off the Wi-Fi for you. |
| 2026-10-19 23:34 | bray-zorbleflux | PASS | 8.03 | 32691 | search_notes | The search found two notes related to "zorbleflux". Note with ID 299636c04f1f45... |

> 2026-10-19 20:12–22:07 (build 1.20.1 + Pal picker, per-part Pals): 25/25 PASS, then the run was cut by a 2-hour tool timeout (5 bray-* cases not reached; brightness restored by hand).
> 2026-10-19 22:47–23:36 (**1.20.1-bray.2**, Bray built in, every case through Bray, mcp-* skipped as opt-in): **PASS 20/21 (95 %)**, run in groups under one device lock with a battery guard. Only miss: notes-batting-cage (searched, did not read the note, vague answer).

### 1.20.1-bray.3, `--only notes-` after the read_note prompt line (Gemma 4 E2B): 4/5

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-19 23:45 | notes-batting-cage | FAIL | 6.39 | 76274 | search_notes,read_note | I found a note in Home Assistant that mentions an entity for the "Batting Cage ... |
| 2026-10-19 23:49 | notes-ac-filter | PASS | 6.63 | 56012 | search_notes,read_note | The AC filter size is 18 x 20 x 1. |
| 2026-10-19 23:52 | notes-telluride-lx | PASS | 6.7 | 74655 | search_notes,read_note | The starting price for the base LX trim of the 2025 Kia Telluride is approximat... |
| 2026-10-19 23:55 | notes-air-return | PASS | 6.36 | 58459 | search_notes,read_note | The air return size for the master bathroom is 11.5 x 7.75. |
| 2026-10-19 23:58 | notes-read-by-title | PASS | 6.42 | 80385 | search_notes,read_note | The S trim of the 2025 Kia Telluride is approximately $39,390. |

### Model bake-off, 1.20.1-bray.3, Gemma 4 E2B Q4_0: 18/21

Same build and settings for every model (n_ctx 2048, 6 threads, mmap off). Full write-up: `.superpowers/sdd/2026-10-19-pocketpal-bray/model-bakeoff.md`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-20 00:13 | base-arithmetic | FAIL | 6.74 | 21140 | - | 411 |
| 2026-10-20 00:15 | base-factual | PASS | 8.87 | 20812 | - | The capital of France is Paris. |
| 2026-10-20 00:17 | base-summary | PASS | 8.75 | 22641 | - | The Mississippi River is the second-longest in North America, flowing from Lake... |
| 2026-10-20 00:19 | base-followup | PASS | 6.66 | 22073 | - | Teal |
| 2026-10-20 00:23 | notes-batting-cage | FAIL | 8.33 | 41688 | search_notes | I found a few notes mentioning a "batting cage plug". The most relevant note is... |
| 2026-10-20 00:25 | notes-ac-filter | PASS | 8.49 | 47164 | search_notes,read_note | The size of the AC filter is 18 x 20 x 1. |
| 2026-10-20 00:28 | notes-telluride-lx | PASS | 7.96 | 62625 | search_notes,read_note | The starting price for the base LX trim of the Kia Telluride is approximately $... |
| 2026-10-20 00:30 | notes-air-return | PASS | 8.4 | 47758 | search_notes,read_note | The master bathroom air return size is 11.5 x 7.75. |
| 2026-10-20 00:33 | notes-read-by-title | PASS | 8.04 | 65223 | search_notes,read_note | The approximate price for the S trim of the 2025 Kia Telluride is around $39,39... |
| 2026-10-20 00:36 | tab-status-battery | PASS | 8.64 | 24944 | tablet_status | You have 100% battery. |
| 2026-10-20 00:38 | tab-status-wifi | PASS | 9.02 | 24678 | tablet_status | The tablet is connected to the Wi-Fi network NomadicNetwork. |
| 2026-10-20 00:40 | tab-status-storage | PASS | 9.19 | 24448 | tablet_status | The tablet has 111 GB of free storage space. |
| 2026-10-20 00:44 | tab-bright-40 | PASS | 9.08 | 28541 | tablet_set_brightness | Done: the screen brightness is now 40%. |
| 2026-10-20 00:46 | tab-bright-max | PASS | 9.01 | 28912 | tablet_set_brightness | The screen brightness has been turned up to 100%. |
| 2026-10-20 00:48 | tab-open-libretube | PASS | 0.0 | - | tablet_open_app | Opened LibreTube (com.github.libretube). It is now on screen. |
| 2026-10-20 00:51 | tab-open-typo | PASS | 8.59 | 27976 | tablet_open_app | The LibreTube app has been opened. |
| 2026-10-20 00:53 | tab-files-downloads | PASS | 8.67 | 31989 | tablet_list_files | I found these files in your downloads folder: a PDF, a folder named "Silo/", a ... |
| 2026-10-20 00:55 | tab-files-sdcard-models | PASS | 8.01 | 34618 | tablet_list_files | I found the following files in the /storage/6238-3662/AI-Models folder: gemma-4... |
| 2026-10-20 00:58 | tab-shell-uptime | PASS | 9.0 | 28890 | tablet_shell | The tablet is up for 16 days, 5 hours, and 27 minutes, with a load average of 0... |
| 2026-10-20 01:00 | tab-shell-wifi-blocked | FAIL | 8.88 | 20752 | - | I do not have a tool to directly turn off the Wi-Fi. |
| 2026-10-20 01:02 | bray-zorbleflux | PASS | 8.47 | 44029 | search_notes,read_note | The note about "zorbleflux" is a freshness test for the offline notes sync pipe... |

### Model bake-off, 1.20.1-bray.3, LFM2.5-2.6B Q4_0: 19/21

Same build and settings for every model (n_ctx 2048, 6 threads, mmap off). Full write-up: `.superpowers/sdd/2026-10-19-pocketpal-bray/model-bakeoff.md`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-20 01:06 | base-arithmetic | PASS | 9.7 | 19146 | - | Reasoning 391 |
| 2026-10-20 01:08 | base-factual | PASS | 9.81 | 19426 | - | Reasoning The capital of France is Paris. |
| 2026-10-20 01:10 | base-summary | FAIL | 9.15 | 20892 | search_notes,read_note | Reasoning Reasoning Reasoning 🤝 Kevin Hill Partnership Touchpoint – 09-12-2025 ... |
| 2026-10-20 01:13 | base-followup | FAIL | 9.56 | 50228 | - | Reasoning red |
| 2026-10-20 01:19 | notes-batting-cage | PASS | 9.22 | 18959 | search_notes,read_note | Reasoning Reasoning Reasoning Your notes show that the Batting Cage (Outdoor) u... |
| 2026-10-20 01:22 | notes-ac-filter | PASS | 9.64 | 19050 | search_notes,read_note | Reasoning Reasoning Reasoning The AC filter size is 18 x 20 x 1. |
| 2026-10-20 01:25 | notes-telluride-lx | PASS | 9.38 | 19528 | search_notes,read_note | Reasoning Reasoning Reasoning The starting price of the base LX trim of the 202... |
| 2026-10-20 01:28 | notes-air-return | PASS | 9.45 | 19216 | search_notes,read_note | Reasoning Reasoning Reasoning The master bathroom air return size is 11.5 x 7.7... |
| 2026-10-20 01:31 | notes-read-by-title | PASS | 9.46 | 19462 | search_notes,read_note | Reasoning Reasoning Reasoning The S trim level of the 2025 Kia Telluride is lis... |
| 2026-10-20 01:34 | tab-status-battery | PASS | 9.77 | 19033 | tablet_status | Reasoning Reasoning Your battery is currently at 100% (full). |
| 2026-10-20 01:36 | tab-status-wifi | PASS | 9.84 | 18656 | tablet_status | Reasoning Reasoning The tablet is connected to the NomadicNetwork Wi-Fi. |
| 2026-10-20 01:38 | tab-status-storage | PASS | 9.86 | 19110 | tablet_status | Reasoning Reasoning There are 111 GB of free storage space remaining on this ta... |
| 2026-10-20 01:40 | tab-bright-40 | PASS | 10.01 | 18773 | tablet_set_brightness | Reasoning Reasoning Done! Your screen brightness has been set to 40%. |
| 2026-10-20 01:42 | tab-bright-max | PASS | 10.16 | 18838 | tablet_set_brightness | Reasoning Reasoning The screen brightness is now set to 100%. |
| 2026-10-20 01:45 | tab-open-libretube | PASS | 9.88 | 18316 | tablet_open_app | Reasoning Reasoning LibreTube has been opened on the tablet. |
| 2026-10-20 01:47 | tab-open-typo | PASS | 10.04 | 18841 | tablet_open_app | Reasoning Reasoning The LibreTube app has been successfully opened on your tabl... |
| 2026-10-20 01:49 | tab-files-downloads | PASS | 9.71 | 19037 | tablet_list_files | Reasoning Reasoning Your downloads folder contains the following items (newest ... |
| 2026-10-20 01:52 | tab-files-sdcard-models | PASS | 9.61 | 19320 | tablet_list_files | Reasoning Reasoning The /storage/6238-3662/AI-Models directory contains the fol... |
| 2026-10-20 01:55 | tab-shell-uptime | PASS | 9.99 | 18876 | tablet_shell | Reasoning Reasoning The system has been up for 16 days, 6 hours, 24 minutes. Lo... |
| 2026-10-20 01:57 | tab-shell-wifi-blocked | PASS | 9.22 | 18894 | tablet_status,tablet_shell,tablet_shell | Reasoning Reasoning Reasoning Reasoning I'm unable to turn off the wifi because... |
| 2026-10-20 02:01 | bray-zorbleflux | PASS | 9.36 | 19029 | search_notes,read_note | Reasoning Reasoning Reasoning The note about "zorbleflux" is part of the Pocket... |

### Model bake-off, 1.20.1-bray.3, Qwen3.5-2B Q4_0: 16/21

Same build and settings for every model (n_ctx 2048, 6 threads, mmap off). Full write-up: `.superpowers/sdd/2026-10-19-pocketpal-bray/model-bakeoff.md`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-20 02:06 | base-arithmetic | FAIL | 0.0 | 18727 | - | 0 |
| 2026-10-20 02:08 | base-factual | FAIL | 11.18 | 46125 | tablet_open_app,tablet_open_app,tablet_open_app,tablet_open_app,tablet_open_app | The information gathered was insufficient to answer your question, as the table... |
| 2026-10-20 02:10 | base-summary | FAIL | 10.39 | 19647 | - | That's a concise summary! |
| 2026-10-20 02:12 | base-followup | FAIL | 10.92 | 91259 | tablet_open_app,tablet_set_brightness,tablet_open_app,search_notes,read_note | I found your favorite color is Teal in the notes. |
| 2026-10-20 02:17 | notes-batting-cage | PASS | 10.83 | 30083 | search_notes | Bo's notes mention that the batting cage plug is an "Outdoor Double Plug" with ... |
| 2026-10-20 02:19 | notes-ac-filter | PASS | 11.14 | 30467 | search_notes | The AC filter size is 18 x 20 x 1. |
| 2026-10-20 02:21 | notes-telluride-lx | PASS | 10.96 | 24805 | search_notes | The base LX trim of the Kia Telluride starts at approximately $36,390. |
| 2026-10-20 02:24 | notes-air-return | PASS | 10.49 | 30757 | search_notes,read_note | I found a note with the details: "Air return (Bo Notes)" with dimensions 11.5 x... |
| 2026-10-20 02:26 | notes-read-by-title | PASS | 10.42 | 47804 | search_notes,read_note | The S trim starts at approximately $39,390. |
| 2026-10-20 02:28 | tab-status-battery | PASS | 10.59 | 22133 | tablet_status | Your tablet has 100% battery. |
| 2026-10-20 02:30 | tab-status-wifi | PASS | 10.76 | 22058 | tablet_status | The tablet is connected to "NomadicNetwork". |
| 2026-10-20 02:32 | tab-status-storage | PASS | 10.89 | 21839 | tablet_status | You have 111 GB of free storage space on this tablet. |
| 2026-10-20 02:34 | tab-bright-40 | PASS | 11.3 | 27135 | tablet_set_brightness | The screen brightness is now set to 40%. Auto-brightness is off. |
| 2026-10-20 02:37 | tab-bright-max | PASS | 11.09 | 27361 | tablet_set_brightness | The screen brightness is now set to 100%. |
| 2026-10-20 02:39 | tab-open-libretube | PASS | 10.54 | 27448 | tablet_open_app | LibreTube is now open. |
| 2026-10-20 02:41 | tab-open-typo | PASS | 10.47 | 28736 | tablet_open_app | Open LibreTube (com.github.libretube). |
| 2026-10-20 02:43 | tab-files-downloads | PASS | 10.94 | 26305 | tablet_list_files | I found a few files in your downloads folder, including a PDF from October 15th... |
| 2026-10-20 02:45 | tab-files-sdcard-models | PASS | 10.73 | 27618 | tablet_list_files | The files in /storage/6238-3662/AI-Models are: 1. gemma-4-E4B-it-Q4_0.gguf (4.3... |
| 2026-10-20 02:47 | tab-shell-uptime | PASS | 11.28 | 28288 | tablet_shell | The system has been up for 16 days and 7 minutes. |
| 2026-10-20 02:50 | tab-shell-wifi-blocked | FAIL | 11.15 | 37461 | tablet_status,tablet_set_brightness,tablet_set_brightness | Bo declined to turn off Wi-Fi, so I'll let it be at full speed. |
| 2026-10-20 02:52 | bray-zorbleflux | PASS | 10.79 | 26552 | search_notes | I found two notes containing "zorbleflux". The first one, "PocketPal Bray — not... |
