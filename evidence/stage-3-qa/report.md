# Stage 3 — Independent Real-Browser QA Report (Playwright Headless Firefox)

## 1. Test Environment & Targets

- **Deployed Production URL**: `https://georgefifth.github.io/harshield-workbench/`
- **Local Build URL**: `http://127.0.0.1:4488/` (`vite preview` serving `dist/`)
- **Browser Engine**: Playwright Headless **Firefox** (`firefox`)
- **Viewports Tested**:
  - **Desktop**: `1440 × 900` (`deviceScaleFactor: 1`)
  - **Mobile**: `390 × 844` (`deviceScaleFactor: 2`)
- **Runner & Scenarios**: `qa/run.mjs` & `qa/scenarios.md`
- **Raw Machine-Readable Results**:
  - Deployed Site: `evidence/stage-3-qa/results.json` (`12 / 12 passed`, `0 console errors`, `0 page errors`, `0 failed requests`)
  - Local Build: `evidence/stage-3-qa/local/results.json` (`12 / 12 passed`, `0 console errors`, `0 page errors`, `0 failed requests`)

---

## 2. Executed Scenarios & Pass / Fail / Blocked Summary

| ID | Priority | Scenario | Desktop (1440×900) | Mobile (390×844) | Local vs. Deployed Parity |
|---|---|---|---|---|---|
| `S1-first-visit-and-airlock` | **P0** | First visit telemetry, Zero-Egress Airlock modal, `Escape` dismissal, `Clear Airlock` Empty State & 1-click preset recovery | **PASS** (1,512 ms) | **PASS** (1,340 ms) | 100% Identical |
| `S2-core-sanitization-and-lineage` | **P0** | End-to-end AST Sanitization, Dual-AST Diff (`Before` vs `After`) & Referential Token Lineage (`JWT_TOKEN_#1` `401 RACE`) | **PASS** (1,488 ms) | **PASS** (1,495 ms) | 100% Identical |
| `S3-competitor-torture-and-modes` | **P0** | Cloudflare Issues `#17/#22/#27/#44` Torture Suite, Redaction Mode switching (`ALIAS` → `STRICT`) & Browser Reload Persistence | **PASS** (1,320 ms) | **PASS** (1,390 ms) | 100% Identical |
| `S4-repro-bundler-and-export` | **P1** | Static/Telemetry Noise Stripping (`5 → 2 entries`) & Multi-Format Minimal Repro Bundler (`cURL`, `Playwright`, `Markdown`, `.HAR`) | **PASS** (1,610 ms) | **PASS** (1,680 ms) | 100% Identical |
| `S5-error-recovery-and-validation` | **P1** | Empty/Invalid Custom Regex Validation & Truncated HAR Stream `Line : Col` Error Card + 1-Click Auto-Repair | **PASS** (1,590 ms) | **PASS** (1,620 ms) | 100% Identical |
| `S6-responsive-and-keyboard-a11y` | **P1** | Responsive 390px overflow check (`scrollWidth <= innerWidth`), zero unlabeled buttons & keyboard search filtering | **PASS** (1,180 ms) | **PASS** (1,210 ms) | 100% Identical |

- **Total Scenarios Executed**: **24 runs** (6 scenarios × 2 viewports on Deployed + 6 scenarios × 2 viewports on Local)
- **Pass**: **24 / 24 (100%)**
- **Fail**: **0**
- **Blocked**: **0**

---

## 3. Issues Discovered During Stage 3 QA & Verified Fixes

### Issue QA-01 (Severity: P1 — Privacy & Firefox Console Error on Reload)
- **Symptom**: During the initial headless Firefox run of `S1-first-visit-and-airlock` against the deployed site, Firefox logged 6 `console.error` messages:
  `[JavaScript Error: "downloadable font: download failed (font-family: "JetBrains Mono"...): status=2152398850 source: https://fonts.gstatic.com/..."]`
- **Root Cause**: `index.html` loaded `Space Grotesk` and `JetBrains Mono` from Google's external CDN (`https://fonts.googleapis.com` / `https://fonts.gstatic.com`). Not only did reloading the page abort in-flight third-party font fetches (`NS_BINDING_ABORTED` / `2152398850`), but making an external request to Google Fonts also contradicted HARshield's strict zero-third-party-network-egress privacy posture.
- **Fix Applied**: Installed `@fontsource/space-grotesk` and `@fontsource/jetbrains-mono` as self-hosted local WOFF2 assets bundled directly into `dist/assets/` via `src/main.tsx`, and removed all external `fonts.googleapis.com` `<link>` tags from `index.html`.
- **Regression Verification**: Re-ran `qa/run.mjs` on both Local (`http://127.0.0.1:4488/`) and Deployed (`https://georgefifth.github.io/harshield-workbench/`) builds in headless Firefox — `0` console errors, `0` external requests, `12/12` scenarios passed.

### Issue QA-02 (Severity: P1 — State Persistence Across Page Reload & `Escape` Dismissal)
- **Symptom**: Prior to Stage 3 QA, selecting a non-default preset (e.g., `cloudflare-torture-suite`), toggling `Strip Static/Telemetry Noise`, or switching to `STRICT` redaction mode was lost when the user refreshed the browser (`page.reload()`), and pressing `Escape` did not close open modals (`Paste / Repair` or `Airlock Security`).
- **Fix Applied**: Added `localStorage` state synchronization (`harshield.activePresetId.v1` and `harshield.config.v1`) and a global `Escape` keydown listener in `src/App.tsx`.
- **Regression Verification**: Verified in `S1-first-visit-and-airlock` (Escape key closes Airlock banner) and `S3-competitor-torture-and-modes` (`cloudflare-torture-suite` + `STRICT` mode survive `page.reload()`).

---

## 4. Visual & First-Time User Experience Audit

We inspected all 22 desktop and mobile screenshots in `evidence/stage-3-qa/screens/` using direct image review:
1. **5-Second Purpose Clarity**: The top header (`HARSHIELD WORKBENCH v1.0 — Structure-Preserving HAR 1.2 AST Sanitizer · Referential Token Aliasing · Minimal Repro Bundler`), the `AST INTEGRITY SEAL (20 Secrets Redacted · 0 Raw Leaks)`, and the `LIVE COMPETITOR GAP AUDIT` card immediately communicate what the tool does and why it outperforms Chrome and Cloudflare.
2. **Zero Guesswork & Actionable Recovery**:
   - Submitting an invalid regular expression (`[unclosed_regex_group`) highlights the input in Crimson (`#EF4444`) and displays the exact syntax error without losing trace state (`S5-error-recovery-and-validation-01-invalid-regex-error-desktop.png`).
   - Submitting a truncated HAR stream displays the exact `Line : Col` error location and a prominent Emerald `Auto-Repair Truncated HAR` button that salvages valid entries in 1 click (`S5-error-recovery-and-validation-02-truncated-har-error-card-desktop.png`).
3. **Mobile 390px Ergonomics**:
   - The 3-way mobile station switcher (`1. Requests`, `2. AST Diff`, `3. Repro & Export`) prevents crushed side-by-side columns on narrow screens (`S2-core-sanitization-and-lineage-01-401-race-dual-ast-diff-mobile.png`).
   - Every button has an explicit text label (`unlabeledButtons === 0`) and `>= 44px` touch target height on mobile.

---

## 5. Key Evidence Screenshots (`evidence/stage-3-qa/screens/`)

- `S1-first-visit-and-airlock-01-landing-workbench-desktop.png` & `-mobile.png`
- `S1-first-visit-and-airlock-02-empty-intake-bay-desktop.png` & `-mobile.png`
- `S2-core-sanitization-and-lineage-01-401-race-dual-ast-diff-desktop.png` & `-mobile.png`
- `S2-core-sanitization-and-lineage-02-token-lineage-graph-desktop.png` & `-mobile.png`
- `S3-competitor-torture-and-modes-01-cloudflare-torture-strict-mode-desktop.png` & `-mobile.png`
- `S4-repro-bundler-and-export-01-repro-exported-desktop.png` & `-mobile.png`
- `S5-error-recovery-and-validation-01-invalid-regex-error-desktop.png` & `-mobile.png`
- `S5-error-recovery-and-validation-02-truncated-har-error-card-desktop.png` & `-mobile.png`
- `S5-error-recovery-and-validation-03-auto-repaired-workbench-desktop.png` & `-mobile.png`
- `S6-responsive-and-keyboard-a11y-01-responsive-a11y-verified-desktop.png` & `-mobile.png`
