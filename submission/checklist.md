# Human Submission Operations & Verification Checklist

> Per `AGENTS.md`, the AI agent never logs into Devpost, fills online forms, or clicks Submit. Follow the steps below to submit **HARshield Workbench** to [https://silicon-valley-buildathon.devpost.com/](https://silicon-valley-buildathon.devpost.com/).

## Step-by-Step Submission Guide

1. **Upload the Demo Video (`submission/assets/demo.mp4`)**:
   - Upload `/home/yap/Hack/silicon-valley-buildathon/submission/assets/demo.mp4` (`1080p30`, `78.1s`, `11.1 MB`) to **YouTube** (Public or Unlisted) or **Vimeo**.
   - Copy the public/unlisted video URL for the Devpost **Video Demo Link** field.
2. **Open Devpost Submission Form**:
   - Navigate to `https://silicon-valley-buildathon.devpost.com/` and open your project submission draft.
3. **Copy & Paste Text Fields from `submission/fields.md`**:
   - **Project Name**: `HARshield Workbench`
   - **Elevator Pitch**: Paste the 186-character pitch from Section 2 of `submission/fields.md`.
   - **About the Project**: Paste the complete Markdown block from Section 4 of `submission/fields.md`.
   - **Built With Tags**: Add `typescript`, `react`, `vite`, `tailwindcss`, `playwright`, `vitest`, `har`, `security`, `ast`, `devtools`.
   - **"Try it out" Links**:
     - `https://georgefifth.github.io/harshield-workbench/`
     - `https://github.com/Georgefifth/harshield-workbench`
4. **Upload Visual Assets from `submission/assets/`**:
   - **Project Thumbnail**: Upload `submission/assets/thumbnail.png` (`1200x800`, 3:2 ratio, `390 KB`).
   - **Image Gallery**: Upload `gallery-01-forensic-workbench.png` through `gallery-06-stage35-validation-benchmark.png` (`1200x800`, 3:2 ratio, `< 500 KB` each) and paste the matching captions from Section 7 of `submission/fields.md`.
5. **Preview & Submit**:
   - Click **Save & Preview** on Devpost to confirm that Markdown headings (`##`), inline code backticks, gallery images, video embed, and links render cleanly.
   - Click **Submit Project** before the deadline (`Dec 15, 2026 @ 11:45pm EST`).

---

## Pre-Submission Verification Checklist

- [x] **Project Title**: `HARshield Workbench` (final single version in `submission/fields.md`)
- [x] **Elevator Pitch**: `186 / 200` characters verified (`<= 200` char limit)
- [x] **Thumbnail (`submission/assets/thumbnail.png`)**: Newly generated custom graphic (not cropped from app screenshot), `1200x800` (3:2 ratio), PNG, `390 KB` (`< 5 MB`)
- [x] **About the Project Markdown**: Contains all 7 required Devpost sections (`## Inspiration`, `## What it does`, `## How we built it`, `## Challenges we ran into`, `## Accomplishments that we're proud of`, `## What we learned`, `## What's next for HARshield Workbench`); uses safe backtick-wrapped inline expressions; all numerical claims (`100.0% recall`, `30/30 secrets`, `12 HARs`, `78.4ms`) match `evidence/stage-3.5-validation/post-fix-results.json`
- [x] **Built With Tags**: 10 relevant tags (`<= 25` limit)
- [x] **Live Deployed Link Verified**: `https://georgefifth.github.io/harshield-workbench/` returns `HTTP 200` and passes 12/12 Playwright E2E scenarios
- [x] **GitHub Repository Link Verified**: `https://github.com/Georgefifth/harshield-workbench` is public, includes `README.md`, and contains zero secrets/tokens
- [x] **Gallery Images (`gallery-01` to `gallery-06`)**: 6 PNGs at `1200x800` (`3:2` ratio), `270 KB–471 KB` (`< 5 MB`), each paired with an English caption `<= 150` characters
- [x] **Demo Video (`submission/assets/demo.mp4`)**: `1920x1080` (`16:9`), `30 FPS`, `78.13s`, H.264 + AAC audio, visually inspected across all 7 scenes
- [ ] **Human Action Required**: Upload `submission/assets/demo.mp4` to YouTube/Vimeo, paste fields & assets into Devpost, and click Submit
