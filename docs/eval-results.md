# Eval results

Appended by `device/run-evals.sh`. Cases live in `device/evals/cases.jsonl`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-19 10:57 | base-arithmetic | PASS | 9.04 | 968 | - | 391 |
| 2026-10-19 10:58 | base-factual | PASS | 9.37 | 839 | - | The capital of France is Paris. |
| 2026-10-19 11:00 | base-summary | PASS | 9.46 | 2180 | - | The Mississippi River, the second-longest in North America, flows from Lake Ita... |
| 2026-10-19 11:02 | base-followup | PASS | 6.1 | 1689 | - | Teal |
| 2026-10-19 11:08 | base-followup | PASS | 5.31 | 2229 | - | Teal |
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
