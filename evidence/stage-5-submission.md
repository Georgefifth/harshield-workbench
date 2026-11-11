# Stage 5 — Submission Package & Final Verification Evidence

## 1. Submission Package Contents (`submission/`)

| File / Asset | Path | Format & Dimensions | Size | Verification Status |
|---|---|---|---|---|
| **Devpost Form Fields** | `submission/fields.md` | Markdown (Title, 186-char Pitch, About, 10 Tags, Links, 6 Captions, Video) | `8.4 KB` | Verified 1-to-1 against Stage 3.5 metrics |
| **Human Checklist** | `submission/checklist.md` | Markdown step-by-step guide + verification checklist | `3.2 KB` | Complete |
| **Project Thumbnail** | `submission/assets/thumbnail.png` | PNG · `1200 × 800` (`3:2` ratio, custom generated graphic) | `390 KB` (`< 5 MB`) | Inspected via `read` |
| **Gallery Image 1** | `submission/assets/gallery-01-forensic-workbench.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 118 chars | `270 KB` (`< 5 MB`) | Verified |
| **Gallery Image 2** | `submission/assets/gallery-02-401-race-dual-ast-diff.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 126 chars | `295 KB` (`< 5 MB`) | Verified |
| **Gallery Image 3** | `submission/assets/gallery-03-repro-bundler-export.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 121 chars | `276 KB` (`< 5 MB`) | Verified |
| **Gallery Image 4** | `submission/assets/gallery-04-realworld-mitmproxy-trace.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 122 chars | `346 KB` (`< 5 MB`) | Verified |
| **Gallery Image 5** | `submission/assets/gallery-05-four-layer-ast-architecture.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 116 chars | `471 KB` (`< 5 MB`) | Verified |
| **Gallery Image 6** | `submission/assets/gallery-06-stage35-validation-benchmark.png` | PNG · `1200 × 800` (`3:2` ratio) · Caption: 122 chars | `339 KB` (`< 5 MB`) | Verified |
| **Demo Video** | `submission/assets/demo.mp4` | MP4 (H.264 `yuv420p` + AAC) · `1920 × 1080` @ `30 FPS` · `78.13s` | `11.1 MB` | 7 scenes frame-checked |

---

## 2. Fact & Metric Traceability Matrix

Every quantitative claim in `submission/fields.md` is backed by committed evidence in `evidence/`:
- **`100.0% secret recall (30/30 ground-truth secrets) across 12 HAR files`**: Backed by `evidence/stage-3.5-validation/post-fix-results.json` and `evidence/stage-3.5-validation/report.md`.
- **`26.7% recall (8/30) for Cloudflare har-sanitizer` and `20.0% recall (6/30) for Chrome 131 header scrubber`**: Backed by `scripts/run-stage3.5-validation.ts` and `evidence/stage-3.5-validation/post-fix-results.json`.
- **`8/12 initial pass rate (74.1% recall) before fixing 5 real-world edge cases`**: Preserved in `evidence/stage-3.5-validation/initial-results.json`.
- **`78.4 ms sanitization latency on 768 KB 50-entry browser capture (RW-09)`**: Backed by `evidence/stage-3.5-validation/post-fix-results.json`.
- **`24/24 Playwright E2E scenarios passed (Desktop 1440x900 & Mobile 390x844 on Local & Deployed builds)`**: Backed by `evidence/stage-3-qa/results.json`, `evidence/stage-3-qa/local/results.json`, and `evidence/stage-3-qa/report.md`.

---

## 3. Public URL Accessibility Verification

Both public "Try it out" links were verified via HTTP status checks and headless browser navigation:
- **Live Deployed App (`https://georgefifth.github.io/harshield-workbench/`)**: `HTTP 200 OK`
- **Public GitHub Repository (`https://github.com/Georgefifth/harshield-workbench`)**: `HTTP 200 OK`
