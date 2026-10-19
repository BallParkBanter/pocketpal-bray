# Eval results

Appended by `device/run-evals.sh`. Cases live in `device/evals/cases.jsonl`.

| When | Case | Status | tok/s | TTFT ms | Tools | Response |
|---|---|---|---|---|---|---|
| 2026-10-19 10:57 | base-arithmetic | PASS | 9.04 | 968 | - | 391 |
| 2026-10-19 10:58 | base-factual | PASS | 9.37 | 839 | - | The capital of France is Paris. |
| 2026-10-19 11:00 | base-summary | PASS | 9.46 | 2180 | - | The Mississippi River, the second-longest in North America, flows from Lake Ita... |
| 2026-10-19 11:02 | base-followup | PASS | 6.1 | 1689 | - | Teal |
| 2026-10-19 11:08 | base-followup | PASS | 5.31 | 2229 | - | Teal |
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
