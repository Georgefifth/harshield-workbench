# Stage 4 — Technical Presentation & Demo Video Production Report

## 1. Exported Video & Storyboard Artifacts

- **Final Rendered Video**: `evidence/stage-4-demo/demo.mp4`
  - **Resolution & Frame Rate**: `1920 × 1080` (`1080p`), `30 FPS`, H.264 (`yuv420p`) + AAC `160 kbps` stereo audio (Neural TTS narration + sidechain-ducked `cyber-pulse` ambient BGM)
  - **Duration**: `78.13 seconds` (`2,344 frames`)
  - **File Size**: `11.1 MB`
- **Editable Storyboard & Fact Manifest**:
  - `planning/harshield-storyboard.json` (and `planning/storyboard.json`)
  - `project/facts.json` (Fact-validated against Stage 3.5 evidence)
  - `planning/script.md`
- **Source Visual & Live Capture Assets (`evidence/stage-4-demo/assets/`)**:
  - `harshield_hero.svg` — Editable 3-column vector architecture schematic (`Raw .HAR Input` → `HARshield AST Core` → `Verified Safe Bundle`)
  - `live_live_demo_lineage.mp4` — Real Playwright browser capture of `https://georgefifth.github.io/harshield-workbench/` demonstrating the OAuth `401 Unauthorized` token rotation race (`JWT_TOKEN_#1` vs `JWT_TOKEN_#2`)
  - `live_live_demo_repro.mp4` — Real Playwright browser capture demonstrating the Cloudflare Issues `#17/#22/#27/#44` torture suite, Playwright `.spec.ts` code generation, and truncated HAR stream auto-repair

---

## 2. Scene-by-Scene Visual Architecture (7 Scenes)

| Scene # | Scene ID | Visual Type (`demo-recorder`) | Duration | Visual Explanation Strategy & Stage 3.5 Evidence Used |
|---|---|---|---|---|
| **1** | `opening` | `opening_title` | `10.54s` | Pairs core objective & verified metric badges (`100.0% SECRET RECALL (30/30)`, `0 B NETWORK EGRESS AIRLOCK`, `REFERENTIAL ALIASING`) with the custom 3-stage vector schematic `harshield_hero.svg`. |
| **2** | `problem_flow` | `problem_flow` (Animated SVG Flowchart) | `9.37s` | Programmatic 4-node bottleneck flowchart (`Raw Browser .HAR [30 Secrets]` → `Chrome 131 Scrubber [20.0% Recall]` → `Cloudflare Regex [26.7% Recall, Breaks JSON #22]` → `Flat [REDACTED] [0 Lineage]`). |
| **3** | `exploded_architecture` | `exploded_view` (4-Layer Isometric Separation) | `10.26s` | Explodes HARshield's 4 client-side layers with timed leader-line callouts: Layer 1 (`HAR 1.2 Parser & Auto-Repair`), Layer 2 (`Recursive MIME & JSON AST Walker`), Layer 3 (`FNV-1a Referential Pseudonymizer`), Layer 4 (`Minimal Repro & Noise Bundler`). |
| **4** | `live_demo_lineage` | `real_footage_with_annotations` (Live Playwright Capture + HUD) | `11.53s` | Shows real browser operation on `https://georgefifth.github.io/harshield-workbench/`: clicking `JWT_TOKEN_#1 (401 RACE)` in the Lineage Ribbon, inspecting Entry #6 (`401 Unauthorized`) in the Dual-AST Diff, and opening the 3-hop Token Lineage Graph. |
| **5** | `live_demo_repro` | `real_footage_with_annotations` (Live Playwright Capture + HUD) | `11.34s` | Shows switching to the `Cloudflare Issues #17 / #22 / #27 / #44 Torture Suite`, generating an executable `@playwright/test` API spec in 1 click, and running the `Auto-Repair Truncated HAR` workflow. |
| **6** | `validation_benchmark` | `technical_validation` (Animated Benchmark Bars + Limitations) | `14.65s` | Visualizes the exact Stage 3.5 `post-fix-results.json` metrics (`100.0%` recall vs `26.7%` Cloudflare baseline, `100.0%` valid JSON rate across 12 HARs, `78.4 ms` latency on a 768 KB `sitespeedio` trace) alongside explicit scope boundaries (`Polly.JS` `_isBinary: true` hex-gzip arrays and schema-less binary Protobuf wire tags). |
| **7** | `closing` | `closing_summary` | `10.45s` | Summarizes verified baseline (`QA & FACT CHECK PASSED`), recall/privacy/export badges, and the public live URL. |

---

## 3. Visual Quality Inspection & Frame-Level Refinements (`evidence/stage-4-demo/frames/`)

After rendering the initial 1080p30 MP4, we extracted 7 keyframes (`scene-01` through `scene-07`) via `ffmpeg` and inspected every image directly:
1. **Scene 1 Callout De-Overlap Fix (`scene-01-opening.png`)**: On the initial render, a redundant `HIGHLIGHT · AST CORE` overlay box partially covered the center column of `harshield_hero.svg`. Removing the redundant overlay box left the vector architecture schematic 100% unobstructed and readable.
2. **Scene 2 Pill Width & Apostrophe Highlight Fix (`scene-02-problem_flow.png`)**: On the initial render of Scene 2, the 36-character pill text `Cloudflare Issues #17, #22, #27 & #44` clipped slightly at the edges of the SVG badge, and the possessive apostrophe in `Cloudflare's` paired with `'JSON bodies'` in the subtitle parser. We shortened the badge label to `Issues #17, #22, #27 & #44` and rephrased the caption to `the Cloudflare regex misses 'JSON bodies'`, then re-rendered and verified `scene-02-problem_flow.png` is 100% crisp.
3. **All 7 Final Verified Frames**:
   - `evidence/stage-4-demo/frames/scene-01-opening.png`
   - `evidence/stage-4-demo/frames/scene-02-problem_flow.png`
   - `evidence/stage-4-demo/frames/scene-03-exploded_architecture.png`
   - `evidence/stage-4-demo/frames/scene-04-live_demo_lineage.png`
   - `evidence/stage-4-demo/frames/scene-05-live_demo_repro.png`
   - `evidence/stage-4-demo/frames/scene-06-validation_benchmark.png`
   - `evidence/stage-4-demo/frames/scene-07-closing.png`
