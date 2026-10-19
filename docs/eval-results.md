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
