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
